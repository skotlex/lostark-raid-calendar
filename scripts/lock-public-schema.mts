/**
 * Supabase가 public 스키마에 열어 두는 공개 API 통로를 막는다.
 *
 * **이 앱은 supabase-js를 쓰지 않는다.** DB에 닿는 길은 Prisma 하나뿐이고 그쪽은
 * 접속 문자열로 `postgres` 롤에 직접 붙는다. 그런데 Supabase 프로젝트는 만들 때부터
 * `postgres`가 public 스키마에 만드는 표에 `anon`·`authenticated` 권한을 자동으로
 * 얹는 기본 권한(default privileges)이 걸려 있다. `prisma db push`로 세운 표 아홉
 * 개가 전부 그 통로를 타고 PostgREST(`/rest/v1/...`)와 GraphQL에 그대로 나와 있었다.
 *
 * anon 키는 브라우저에 박으라고 만든 키다. 즉 **비밀이 아니다.** RLS가 꺼져 있으면
 * 프로젝트 주소와 그 키를 아는 사람은 누구나 읽고 쓰고 지울 수 있다. 실제로 2026-09-06
 * Supabase가 `rls_disabled_in_public`으로 알려 왔다.
 *
 * 두 겹으로 막는다. 한 겹만으로는 다음에 표가 늘 때 다시 열린다.
 *
 *   1. 표마다 RLS를 켠다. 정책을 하나도 두지 않으므로 anon은 아무것도 못 한다
 *   2. anon·authenticated의 표 권한을 회수하고, **기본 권한 자체를 끈다.**
 *      이게 없으면 `db push`로 만드는 다음 표가 또 권한을 달고 태어난다
 *
 * **앱은 영향을 받지 않는다.** Supabase의 `postgres` 롤은 `BYPASSRLS`를 갖고 있고
 * 표의 소유자이기도 해서 RLS를 두 가지 이유로 통과한다. 런타임(트랜잭션 풀러)과
 * 스키마 작업(세션 풀러) 양쪽 모두 이 롤로 붙는 것을 확인했다.
 *
 * 사용법:
 *
 *   npm run db:lock -- --check    현재 상태만 본다
 *   npm run db:lock               잠근다 (여러 번 돌려도 안전하다)
 *
 * **표를 새로 만들면 한 번 더 돌린다.** 2번 덕분에 새 표에 anon 권한이 붙지는
 * 않지만 RLS는 꺼진 채로 태어나고, Supabase 린터는 그것만 보고 경고를 올린다.
 */
import pg from "pg";

const { Client } = pg;

/** 잠글 대상 롤. PostgREST가 요청자를 이 둘 중 하나로 바꿔 앉힌다. */
const EXPOSED_ROLES = ["anon", "authenticated"];

const LOCK_SQL = `
-- 1. RLS. 정책을 두지 않으므로 소유자와 BYPASSRLS 롤 말고는 아무도 못 읽는다.
DO $$
DECLARE target regclass;
BEGIN
  FOR target IN
    SELECT c.oid::regclass
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END $$;

-- 2. 이미 붙어 있는 권한 회수. 지금은 표뿐이지만 시퀀스·함수가 생겨도 걸리도록 둔다.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3. 앞으로 postgres가 만드는 것에도 붙지 않게. **이 줄이 재발을 막는다.**
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
`;

type TableRow = {
  table: string;
  rls: boolean;
  exposed: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}이 없다. .env.local을 확인한다`);
  }
  return value;
}

async function report(client: pg.Client): Promise<TableRow[]> {
  const res = await client.query<TableRow>(
    `SELECT c.relname AS table,
            c.relrowsecurity AS rls,
            (SELECT string_agg(DISTINCT g.grantee, ', ' ORDER BY g.grantee)
               FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'public'
                AND g.table_name = c.relname
                AND g.grantee = ANY($1::text[])) AS exposed
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname`,
    [EXPOSED_ROLES],
  );

  console.log("표".padEnd(16) + "RLS".padEnd(8) + "공개 롤 권한");
  console.log("-".repeat(44));
  for (const row of res.rows) {
    console.log(
      row.table.padEnd(16) +
        (row.rls ? "켜짐" : "꺼짐").padEnd(8) +
        (row.exposed ?? "없음"),
    );
  }

  return res.rows;
}

/**
 * 기본 권한에 아직 공개 롤이 남아 있는지 본다. 표 권한을 회수해도 이게 남아 있으면
 * 다음 `db push`가 만드는 표부터 도로 열린다.
 */
async function defaultPrivilegesLeak(client: pg.Client): Promise<boolean> {
  const res = await client.query<{ leaking: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM pg_default_acl d
         JOIN pg_namespace n ON n.oid = d.defaclnamespace
        WHERE n.nspname = 'public'
          AND pg_get_userbyid(d.defaclrole) = 'postgres'
          AND EXISTS (
            SELECT 1 FROM unnest(d.defaclacl) AS acl
             WHERE split_part(acl::text, '=', 1) = ANY($1::text[])
          )
     ) AS leaking`,
    [EXPOSED_ROLES],
  );
  return res.rows[0].leaking;
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const client = new Client({ connectionString: requireEnv("DATABASE_URL_UNPOOLED") });
  await client.connect();

  try {
    if (checkOnly) {
      const rows = await report(client);
      const leaking = await defaultPrivilegesLeak(client);
      const open = rows.filter((r) => !r.rls || r.exposed);

      console.log("");
      if (open.length === 0 && !leaking) {
        console.log("잠겨 있다.");
      } else {
        if (open.length > 0) {
          console.log(`열려 있는 표 ${open.length}개. npm run db:lock 을 돌린다`);
        }
        if (leaking) {
          console.log("기본 권한에 공개 롤이 남아 있다. 다음에 만드는 표가 또 열린다");
        }
      }
      return;
    }

    await client.query("BEGIN");
    await client.query(LOCK_SQL);
    await client.query("COMMIT");

    console.log("=== 잠근 뒤 ===");
    await report(client);
    console.log("");
    console.log(
      (await defaultPrivilegesLeak(client))
        ? "기본 권한이 아직 남아 있다. 위 SQL을 확인한다"
        : "기본 권한도 정리했다. 다음에 만드는 표는 열리지 않는다",
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

await main();

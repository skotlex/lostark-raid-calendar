/**
 * DB를 통째로 옮긴다. Neon → Supabase 이전에 쓴 일회성 도구다.
 *
 * `pg_dump`를 쓰지 않는 이유는 하나다 — 테이블 아홉 개를 옮기자고 PostgreSQL
 * 클라이언트 도구를 통째로 설치할 이유가 없다. `pg`는 이미 의존성에 있다.
 *
 * 사용법:
 *
 *   node --env-file=.env.local scripts/migrate-db.mts --check
 *   node --env-file=.env.local scripts/migrate-db.mts
 *
 * `--check`는 양쪽 행 수만 세어 보여준다. 옮기기 전과 후에 한 번씩 돌려 맞는지 본다.
 *
 * 읽는 곳은 `MIGRATE_FROM`, 쓰는 곳은 `DATABASE_URL_UNPOOLED`(풀러를 거치지 않는
 * 쪽)다. 대량 INSERT라 트랜잭션 풀러로 보내지 않는다.
 *
 * **스키마는 이 스크립트가 만들지 않는다.** 먼저 `npm run db:push`로 대상에 표를
 * 세워 둔다. 스키마의 정답지는 prisma/schema.prisma 하나여야 하고, 여기서 CREATE
 * TABLE을 흉내 내면 그 자리가 둘로 갈린다.
 */
import pg from "pg";

const { Client } = pg;

/**
 * 옮기는 차례. **부모가 앞에 선다.**
 *
 * FK가 걸려 있어 순서를 바꾸면 자식 행이 먼저 들어가다 걸린다. 제약을 잠시 끄는
 * 방법(`session_replication_role`)도 있지만 Supabase의 postgres 롤에 그 권한이
 * 있는지가 확실하지 않다. 아홉 개뿐이라 손으로 세우는 편이 확실하다.
 *
 * **Presence는 옮기지 않는다.** 몇 초마다 덮어쓰이는 발자국이고 35초만 지나면
 * 아무도 읽지 않는다(CLAUDE.md 2-4). 옮겨봐야 도착하는 순간 이미 만료다.
 */
const TABLES = [
  "Instance",
  "UserSetting",
  "Member",
  "Roster",
  "Character",
  "RaidSlot",
  "Assignment",
  "ChangeLog",
];

/** 한 번에 넣을 행 수. 파라미터가 너무 많아지면 Postgres가 거절한다(65535개 상한). */
const BATCH = 200;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}이 없다. .env.local을 확인한다`);
  }
  return value;
}

/** `"Character"`처럼 대문자가 섞인 이름이라 따옴표가 없으면 소문자로 접힌다. */
function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function countRows(client: pg.Client, table: string): Promise<number> {
  const res = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${quote(table)}`,
  );
  return Number(res.rows[0].n);
}

async function check(from: pg.Client, to: pg.Client): Promise<void> {
  console.log("표".padEnd(16) + "읽는 곳".padStart(10) + "쓰는 곳".padStart(10));
  console.log("-".repeat(36));
  for (const table of TABLES) {
    const [a, b] = await Promise.all([countRows(from, table), countRows(to, table)]);
    const mark = a === b ? "" : "   ← 다름";
    console.log(table.padEnd(16) + String(a).padStart(10) + String(b).padStart(10) + mark);
  }
}

/**
 * 열의 실제 타입을 읽는다. **값을 그대로 되넣으면 안 되는 열이 있어서다.**
 *
 * `jsonb` 열은 pg가 읽을 때 객체로 풀어 주는데, 그 객체를 그대로 파라미터로 넘기면
 * 다시 JSON으로 굳혀 준다. 문제는 **배열**이다 — pg는 JS 배열을 Postgres 배열
 * 리터럴로 적어서 jsonb 열에 넣으면 깨진다. 그래서 json 계열만 직접 문자열로 만든다.
 */
async function jsonColumns(client: pg.Client, table: string): Promise<Set<string>> {
  const res = await client.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
        AND data_type IN ('json', 'jsonb')`,
    [table],
  );
  return new Set(res.rows.map((r) => r.column_name));
}

async function copyTable(from: pg.Client, to: pg.Client, table: string): Promise<void> {
  const existing = await countRows(to, table);
  if (existing > 0) {
    console.log(`${table.padEnd(16)} 건너뜀 (쓰는 곳에 이미 ${existing}행)`);
    return;
  }

  const source = await from.query(`SELECT * FROM ${quote(table)}`);
  if (source.rows.length === 0) {
    console.log(`${table.padEnd(16)} 0행`);
    return;
  }

  const columns = source.fields.map((f) => f.name);
  const jsonCols = await jsonColumns(from, table);
  const columnList = columns.map(quote).join(", ");

  for (let i = 0; i < source.rows.length; i += BATCH) {
    const chunk = source.rows.slice(i, i + BATCH);
    const values: unknown[] = [];
    const tuples: string[] = [];

    for (const row of chunk) {
      const holes: string[] = [];
      for (const col of columns) {
        const value = (row as Record<string, unknown>)[col];
        values.push(
          jsonCols.has(col) && value !== null ? JSON.stringify(value) : value,
        );
        holes.push(`$${values.length}`);
      }
      tuples.push(`(${holes.join(", ")})`);
    }

    await to.query(
      `INSERT INTO ${quote(table)} (${columnList}) VALUES ${tuples.join(", ")}`,
      values,
    );
  }

  console.log(`${table.padEnd(16)} ${source.rows.length}행 옮김`);
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");

  const from = new Client({ connectionString: requireEnv("MIGRATE_FROM") });
  const to = new Client({ connectionString: requireEnv("DATABASE_URL_UNPOOLED") });

  await from.connect();
  await to.connect();

  try {
    if (checkOnly) {
      await check(from, to);
      return;
    }

    for (const table of TABLES) {
      await copyTable(from, to, table);
    }

    console.log("");
    console.log("=== 옮긴 뒤 행 수 ===");
    await check(from, to);
  } finally {
    await from.end();
    await to.end();
  }
}

await main();

import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "prisma/config";

/**
 * Prisma 7 설정.
 *
 * 접속 URL이 schema.prisma에서 이곳으로 옮겨졌다. 여기 값은 마이그레이션과
 * introspection 같은 CLI 작업에만 쓰이고, 앱 런타임 접속은 src/lib/prisma.ts의
 * 드라이버 어댑터가 담당한다.
 *
 * Prisma 7은 .env를 자동으로 읽지 않으므로 직접 로드한다.
 * Next.js와 같은 우선순위(.env.local 우선)를 따른다.
 */
for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) {
    process.loadEnvFile(file);
  }
}

// Supabase는 풀링(Supavisor, 6543)/직결(5432) 두 가지 접속 문자열을 준다.
// prisma db push / migrate 같은 스키마 작업은 트랜잭션 풀러를 통과할 수 없어
// 직결 URL이 필요하다. 앱 런타임은 반대로 풀링을 쓴다(src/lib/prisma.ts).
//
// `_UNPOOLED`라는 이름은 Neon을 쓰던 때 그 Vercel 연동이 넣어주던 것을 그대로
// 물려받았다. Supabase는 이 이름을 쓰지 않지만 배포에 이미 박혀 있는 값이라 두었다.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "node --env-file=.env.local prisma/seed.mts",
  },
  // DATABASE_URL이 없어도 `prisma generate`는 돌아야 한다. DB가 필요한 명령만
  // 실패하도록 값이 있을 때만 넘긴다.
  ...(url ? { datasource: { url } } : {}),
});

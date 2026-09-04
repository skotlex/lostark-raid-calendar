import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7은 드라이버 어댑터로 접속한다. 접속 문자열이 schema.prisma가 아니라
 * 여기서 읽히므로, DATABASE_URL이 없으면 이 지점에서 바로 드러난다.
 *
 * 개발 중 HMR이 돌 때마다 새 PrismaClient가 생기면 커넥션이 금방 고갈된다.
 * globalThis에 하나만 붙여 재사용한다.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL이 없다. .env.local을 확인한다");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

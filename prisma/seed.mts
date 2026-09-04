/**
 * 초기 데이터.
 *
 * 기본 인스턴스 하나만 만든다. 1단계는 암호 없이 링크만 알면 들어올 수 있으므로
 * passwordHash는 null이다.
 *
 * 실행:
 *   npm run db:seed                  기본 인스턴스만
 *   npm run db:seed -- --with-samples  예시 슬롯까지 (화면 확인용)
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL이 없다. .env.local을 확인한다.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEFAULT_SLUG = "main";

const instance = await prisma.instance.upsert({
  where: { slug: DEFAULT_SLUG },
  update: {},
  create: {
    slug: DEFAULT_SLUG,
    name: "모여라!",
    // 1단계: 암호 없음. 링크를 아는 사람은 누구나 편집한다.
    passwordHash: null,
  },
});

console.log(`인스턴스 준비 완료: /${instance.slug} (${instance.name})`);

if (process.argv.includes("--with-samples")) {
  const existing = await prisma.raidSlot.count({ where: { instanceId: instance.id } });
  if (existing > 0) {
    console.log(`슬롯이 이미 ${existing}개 있어 예시를 넣지 않는다.`);
  } else {
    // 0=일 … 6=토
    const samples = [
      { dayOfWeek: 4, startTime: "20:00", raidName: "노르둠", difficulty: "하드", minItemLevel: 1740 },
      { dayOfWeek: 4, startTime: "22:00", raidName: "하기르", difficulty: "하드", minItemLevel: 1760 },
      { dayOfWeek: 6, startTime: "21:00", raidName: "벨가르딘", difficulty: "나이트메어", minItemLevel: 1780, keepRoster: true },
    ];

    await prisma.raidSlot.createMany({
      data: samples.map((s, i) => ({ ...s, instanceId: instance.id, sortOrder: i })),
    });
    console.log(`예시 슬롯 ${samples.length}개를 넣었다.`);
  }
}

await prisma.$disconnect();

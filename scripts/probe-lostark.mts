/**
 * 로아 OpenAPI 응답 확인용 진단 스크립트.
 *
 * 처음에는 각인·아크그리드의 구조를 알아내려고 만들었고, 구조가 확정된 지금은
 * 정규화가 실제 응답에 대해 제대로 도는지 확인하는 용도로 쓴다.
 * 게임 개편으로 응답이 바뀌면 여기부터 돌려본다.
 *
 * 실행:
 *   npm run probe -- 캐릭터명
 *
 * 응답 전문은 .probe/ 아래에 저장된다(gitignore 대상).
 */

import { mkdir, writeFile } from "node:fs/promises";

import {
  normalizeArkGrid,
  normalizeArkPassive,
  normalizeEngravings,
  summarizeEngravings,
  toCharacterSpec,
} from "../src/lib/armory.ts";
import { coreTier, summarizeArkGrid } from "../src/lib/arkGridCores.ts";
import { fetchArmory, fetchSiblings } from "../src/lib/lostark.ts";

const characterName = process.argv[2];

if (!characterName) {
  console.error("사용법: npm run probe -- 캐릭터명");
  process.exit(1);
}

/** 낯선 구조를 만났을 때 필드 목록을 훑어보는 도우미. */
function describe(value: unknown, depth = 0): string {
  const pad = "  ".repeat(depth + 1);
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[] (빈 배열)";
    return `배열 (${value.length}개), 첫 요소:\n${describe(value[0], depth + 1)}`;
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const preview =
          v === null
            ? "null"
            : Array.isArray(v)
              ? `배열(${v.length})`
              : typeof v === "object"
                ? "객체"
                : `${typeof v} = ${JSON.stringify(v)?.slice(0, 80)}`;
        return `${pad}${k}: ${preview}`;
      })
      .join("\n");
  }
  return `${typeof value} = ${JSON.stringify(value)}`;
}

const armory = await fetchArmory(characterName);

if (!armory) {
  console.error(`'${characterName}' 조회 결과가 비어 있다. 닉네임을 확인한다.`);
  process.exit(1);
}

await mkdir(".probe", { recursive: true });
const dumpPath = `.probe/armory-${characterName}.json`;
await writeFile(dumpPath, JSON.stringify(armory, null, 2), "utf8");

console.log("\n=== 응답 최상위 키 ===");
console.log(Object.keys(armory).join(", "));

const spec = toCharacterSpec(armory);
console.log("\n=== 1. 정규화 결과 (DB에 들어갈 값) ===");
if (!spec) {
  console.log("ArmoryProfile이 null이라 정규화할 수 없다.");
} else {
  console.log(`클래스:          ${spec.className}`);
  console.log(`서버:            ${spec.serverName}`);
  console.log(`템레벨:          ${spec.itemLevel}`);
  console.log(`전투력:          ${spec.combatPower ?? "null → 수동 입력으로 내려야 한다"}`);
  console.log(`이미지:          ${spec.imageUrl ?? "null (배경 fallback 필요)"}`);
  console.log(`직업 각인:       ${spec.classEngraving ?? "-"}`);
  console.log(`전투 각인:       ${summarizeEngravings(spec.engravings) ?? "-"}`);
  console.log(`아크그리드 요약: ${summarizeArkGrid(spec.arkGrid) ?? "-"}`);
}

console.log("\n=== 2. 아크패시브 (직업 각인은 깨달음 1티어) ===");
const arkPassive = normalizeArkPassive(armory.ArkPassive);
if (!arkPassive) {
  console.log("  (없음)");
} else {
  console.log(`  포인트: ${JSON.stringify(arkPassive.points)}`);
  for (const n of arkPassive.nodes) {
    // 직업 각인은 티어로 가릴 수 없다. 아크그리드 코어 조건에서 읽는다(1번 항목).
    console.log(`  ${n.category} ${n.tier}티어 ${n.name} Lv.${n.level}`);
  }
}

console.log("\n=== 3. 전투 각인 상세 (직업 각인 아님) ===");
const engravings = normalizeEngravings(armory.ArmoryEngraving);
if (!engravings) {
  console.log("  (없음)");
} else {
  for (const e of engravings.list) {
    const stone = e.stoneLevel !== null ? ` [스톤 ${e.stoneLevel}]` : "";
    console.log(`  ${e.name} ${e.level ?? "?"} (${e.grade ?? "?"})${stone}`);
  }
}

console.log("\n=== 3. 아크그리드 상세 ===");
const arkGrid = normalizeArkGrid(armory.ArkGrid);
if (!arkGrid) {
  console.log("  (없음)");
} else {
  for (const c of arkGrid.cores) {
    const inactive = c.inactiveGemCount > 0 ? ` (비활성 ${c.inactiveGemCount})` : "";
    const tier = coreTier(c.name);
    console.log(
      `  [${tier ?? "?"}단계] ${c.name} | ${c.grade} | ${c.point}p | 젬 ${c.gemCount}개${inactive}`,
    );
  }
  for (const e of arkGrid.effects) {
    console.log(`  효과: ${e.text ?? e.name} (Lv.${e.level})`);
  }
}

// 아크그리드 원본은 툴팁이 대부분을 차지한다. 정규화가 이걸 얼마나 걷어내는지 확인한다.
console.log("\n=== 4. 저장 크기 ===");
const rawSize = JSON.stringify(armory.ArkGrid ?? {}).length;
const normSize = JSON.stringify(arkGrid ?? {}).length;
console.log(`  아크그리드 원본 ${rawSize} → 정규화 ${normSize} bytes`);
console.log(`  각인 정규화 ${JSON.stringify(engravings ?? {}).length} bytes`);

console.log("\n=== 5. 원정대 목록 ===");
const siblings = await fetchSiblings(characterName);
console.log(`${siblings.length}개 캐릭터`);
for (const s of siblings.slice(0, 5)) {
  console.log(`  ${s.CharacterName} / ${s.CharacterClassName} / ${s.ItemAvgLevel}`);
}
if (siblings.length > 5) console.log(`  … 외 ${siblings.length - 5}개`);

console.log(`\n전문 저장: ${dumpPath}`);
console.log("구조가 낯설면 아래를 참고한다.");
console.log(describe(armory.ArkGrid));

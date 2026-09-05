/**
 * 레이드 프리셋.
 *
 * 슬롯을 만들 때 드롭다운으로 제안하는 목록일 뿐이다. `raidName`은 자유 입력이므로
 * 신규 레이드가 나와도 앱 수정 없이 쓸 수 있다. 여기 없는 이름을 적어도 정상이다.
 *
 * 로아 OpenAPI에는 레이드 목록도 난이도도 없다(CLAUDE.md 3.3-1). 여기가 유일한 출처라
 * 패치가 나오면 손으로 채운다.
 */

import { DEFAULT_PARTY_SIZE, type PartySize } from "./positions";

export interface RaidPreset {
  name: string;
  /** 8인이면 4인 파티 둘, 4인이면 하나. */
  size: PartySize;
  difficulties: string[];
}

export const RAID_PRESETS: RaidPreset[] = [
  { name: "벨가르딘", size: 8, difficulties: ["노말", "하드", "나이트메어"] },
  { name: "세르카", size: 4, difficulties: ["노말", "하드", "나이트메어"] },
  { name: "종막:최후의 날", size: 8, difficulties: ["노말", "하드"] },
  { name: "지평의 성당", size: 4, difficulties: ["1단계", "2단계", "3단계"] },
];

function presetFor(raidName: string): RaidPreset | undefined {
  return RAID_PRESETS.find((r) => r.name === raidName.trim());
}

/** 프리셋에 있는 이름이면 난이도 후보를 준다. 없으면 기본 후보. */
export function difficultiesFor(raidName: string): string[] {
  return presetFor(raidName)?.difficulties ?? ["노말", "하드"];
}

/**
 * 프리셋에 있는 이름이면 인원을 준다. 없으면 8인.
 *
 * 자유 입력이라 모르는 이름이 얼마든지 들어온다. 8인이 훨씬 흔하므로 그쪽으로 둔다.
 */
export function sizeFor(raidName: string): PartySize {
  return presetFor(raidName)?.size ?? DEFAULT_PARTY_SIZE;
}

/** "벨가르딘 하드"처럼 화면에 한 줄로 표시한다. */
export function raidLabel(raidName: string, difficulty: string | null | undefined): string {
  return difficulty ? `${raidName} ${difficulty}` : raidName;
}

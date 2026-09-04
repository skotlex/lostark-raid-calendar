/**
 * 레이드 프리셋.
 *
 * 슬롯을 만들 때 드롭다운으로 제안하는 목록일 뿐이다. `raidName`은 자유 입력이므로
 * 신규 레이드가 나와도 앱 수정 없이 쓸 수 있다. 여기 없는 이름을 적어도 정상이다.
 *
 * 초기 목록은 기존 길드 시트에서 실제로 굴리던 레이드에서 가져왔다.
 */

export interface RaidPreset {
  name: string;
  difficulties: string[];
}

export const RAID_PRESETS: RaidPreset[] = [
  { name: "노르둠", difficulties: ["노말", "하드"] },
  { name: "하기르", difficulties: ["노말", "하드"] },
  { name: "벨가르딘", difficulties: ["노말", "하드", "나이트메어"] },
  { name: "세르카", difficulties: ["노말", "하드"] },
];

/** 프리셋에 있는 이름이면 난이도 후보를 준다. 없으면 기본 후보. */
export function difficultiesFor(raidName: string): string[] {
  const preset = RAID_PRESETS.find((r) => r.name === raidName);
  return preset?.difficulties ?? ["노말", "하드"];
}

/** "벨가르딘 하드"처럼 화면에 한 줄로 표시한다. */
export function raidLabel(raidName: string, difficulty: string | null | undefined): string {
  return difficulty ? `${raidName} ${difficulty}` : raidName;
}

/**
 * 클래스별 대표 색.
 *
 * 캐릭터 이미지가 없거나 로드에 실패했을 때 칸 배경으로 쓴다. 깨진 이미지 아이콘 대신
 * 클래스를 알아볼 수 있는 단색이 뜨게 하려는 목적이다.
 *
 * 어두운 바탕 위에 얹히므로 채도를 낮춘 어두운 색으로만 고른다. 이 위에 흰 글씨가
 * 올라가도 대비가 유지되어야 한다.
 */

const CLASS_COLORS: Record<string, string> = {
  // 전사
  버서커: "#7a2f2f",
  디스트로이어: "#6b4a2a",
  워로드: "#4a5a7a",
  홀리나이트: "#6b6440",
  슬레이어: "#7a2f4a",
  발키리: "#6b5a7a",
  가디언나이트: "#3f5a6b",
  // 무도가
  배틀마스터: "#2f6b5a",
  인파이터: "#6b3f2f",
  기공사: "#2f5a6b",
  창술사: "#5a6b2f",
  스트라이커: "#6b512f",
  브레이커: "#4a3f6b",
  // 헌터
  데빌헌터: "#3f4a6b",
  블래스터: "#6b4a3f",
  호크아이: "#3f6b4a",
  스카우터: "#2f6b6b",
  건슬링어: "#6b3f5a",
  // 마법사
  바드: "#4a6b7a",
  서머너: "#3f6b3f",
  아르카나: "#6b2f5a",
  소서리스: "#5a3f7a",
  // 암살자
  데모닉: "#5a2f6b",
  블레이드: "#2f3f6b",
  리퍼: "#3a3a4a",
  소울이터: "#4a2f5a",
  // 스페셜리스트
  도화가: "#7a5a4a",
  기상술사: "#4a6b6b",
  환수사: "#5a7a4a",
};

/** 표에 없는 클래스(신규 직업 등)는 중립 회색으로 떨어진다. */
const FALLBACK = "#2a3441";

export function classColor(className: string | null | undefined): string {
  if (!className) return FALLBACK;
  return CLASS_COLORS[className] ?? FALLBACK;
}

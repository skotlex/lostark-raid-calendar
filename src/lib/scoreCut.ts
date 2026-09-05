/**
 * 점수컷 — 요일표에 걸어 두는 안내.
 *
 * **막지 않는다.** 캐릭터 스펙과 견주지도 않는다. 공대장이 적어 둔 숫자를 편성표
 * 머리글에 그대로 내걸어, 칸에 이름을 치기 전에 눈에 걸리게 하는 것이 전부다.
 * 하드 블로킹을 두지 않는다는 규칙(CLAUDE.md 3.4)이 여기에도 그대로 걸린다.
 *
 * **어느 값을 재는 컷인지는 정하지 않는다.** 전투력으로 자르는 공대도 있고 템레벨로
 * 자르는 공대도 있다. 앱이 한쪽으로 못 박으면 다른 쪽은 이 칸을 못 쓴다. 견주지
 * 않으니 단위를 알 필요도 없다.
 *
 * **부등호는 앱이 붙인다.** 사람은 숫자만 친다. "5000 이상"과 "5000이상"과 "5000~"이
 * 섞이면 같은 뜻인데 슬롯마다 다르게 읽히고, 나중에 값으로 다룰 길도 막힌다.
 *
 * server-only가 아니다. 저장하는 쪽(slots.ts)과 그리는 쪽(SlotHeader 등)이 같은
 * 규칙을 써야 폼에 친 값과 뱃지에 뜨는 값이 갈리지 않는다.
 */

/**
 * 점수컷의 위 한계.
 *
 * 자릿수를 하나 더 친 값을 거른다. 전투력이든 템레벨이든 여섯 자리를 넘지 않는다.
 */
export const MAX_SCORE_CUT = 999_999;

/** 세 자리마다 끊는 글자. 지우는 키를 다루는 쪽이 이 글자를 알아야 한다. */
export const SCORE_CUT_SEPARATOR = ",";

const MAX_DIGITS = String(MAX_SCORE_CUT).length;

/**
 * 세 자리마다 끊는다.
 *
 * `toLocaleString`을 쓰지 않는다. 이 값은 서버가 그린 HTML과 브라우저가 다시 그린
 * 결과가 같아야 하는데, 로케일 자료는 실행하는 쪽마다 다를 수 있다. 끊는 규칙이
 * 한 가지뿐이라 직접 넣는 편이 짧기도 하다.
 */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+$)/g, SCORE_CUT_SEPARATOR);
}

/** 글자에서 숫자만. */
function digitsOf(text: string): string {
  return text.replace(/[^0-9]/g, "");
}

/**
 * 입력 칸에 남길 글자. 숫자만 남기고 세 자리마다 끊는다.
 *
 * 앞의 0은 버린다. `0`으로 시작하는 컷은 없고, 남겨 두면 `0005,000` 같은 글자가
 * 칸에 선다. 자릿수 제한은 0을 버린 뒤에 센다.
 */
export function formatScoreCutInput(value: string): string {
  return group(digitsOf(value).replace(/^0+/, "").slice(0, MAX_DIGITS));
}

/** 캐럿 앞에 숫자가 몇 개인가. */
export function scoreCutDigitCount(text: string): number {
  return digitsOf(text).length;
}

/**
 * 앞에서부터 숫자 `count`개를 지난 자리.
 *
 * 콤마가 붙거나 빠지면 같은 숫자라도 글자 수가 달라진다. 캐럿을 글자 수로 되돌리면
 * `1000`에 콤마가 붙는 순간 한 칸씩 밀려 `1,00|0`에 선다. 숫자 개수로 되돌린다.
 */
export function scoreCutCaret(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] >= "0" && text[i] <= "9") {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return text.length;
}

/**
 * 폼에서 온 글자를 값으로.
 *
 * 빈 값은 `null`(컷 없음)이다. 숫자가 아니면 `NaN`을 돌려주고 거르는 일은 호출부에
 * 맡긴다. 여기서 0으로 떨어뜨리면 "컷 없음"과 "잘못 친 값"이 같은 값이 된다.
 */
export function parseScoreCut(raw: unknown): number | null {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  return Number(text);
}

/** 저장해도 되는 값인가. `null`(컷 없음)도 유효하다. */
export function isScoreCut(value: number | null): boolean {
  if (value === null) return true;
  return Number.isInteger(value) && value > 0 && value <= MAX_SCORE_CUT;
}

/** 값만. "5,000" */
export function scoreCutNumber(value: number): string {
  return group(String(value));
}

/** 뱃지에 찍는 글. "≥ 5,000" */
export function formatScoreCut(value: number): string {
  return `≥ ${scoreCutNumber(value)}`;
}

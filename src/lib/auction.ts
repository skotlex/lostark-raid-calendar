/**
 * 경매 입찰 적정가.
 *
 * 레이드에서 나온 물품을 경매에 붙이면 낙찰자가 낸 골드가 나머지 공대원에게 똑같이
 * 나뉜다. 입찰하지 않고 가만히 있어도 그 몫은 들어오므로, 물건값에서 그 몫을 뺀 만큼이
 * 손해가 없는 선이다. 인원이 많을수록 내 몫이 작아져 더 높게 불러도 된다.
 *
 * **공식은 역산했다.** 사용자가 쓰던 계산기의 결과(시세 108,000 → 4인 70,024 ·
 * 8인 81,695 · 16인 87,530)에서 거꾸로 풀었고 세 값이 골드 단위까지 맞는다.
 *
 *   적정가 = 내림(시세 × 0.95 × (N−1)/N × 0.91)
 *
 * | 항 | 뜻 |
 * |---|---|
 * | 0.95 | 거래소에 되팔 때 떼는 수수료 5% |
 * | (N−1)/N | 낸 골드가 나를 뺀 N−1명에게 나뉜다. 여기까지가 손익분기점이다 |
 * | 0.91 | 분기점에 딱 맞춰 사면 남는 것이 없다. 거기서 9%를 덜 낸다 |
 *
 * 0.91을 `1/1.1`(0.909…)로 "고치지" 않는다. 그 값이면 108,000이 69,954가 되어
 * 기준으로 삼은 계산기와 어긋난다. 반올림이 아니라 내림인 것도 같은 이유다
 * (4인이 70,024.5라 반올림하면 70,025).
 *
 * server-only가 아니다. 화면이 치는 대로 바로 다시 계산한다.
 */

/** 로아 레이드 인원. 경매에 참여하는 사람 수가 곧 나눠 갖는 사람 수다. */
export const AUCTION_PARTY_SIZES = [4, 8, 16] as const;

export type AuctionPartySize = (typeof AUCTION_PARTY_SIZES)[number];

/** 세 자리마다 끊는 글자. 지우는 키를 다루는 쪽이 이 글자를 알아야 한다. */
export const GOLD_SEPARATOR = ",";

/**
 * 칸에 칠 수 있는 자릿수.
 *
 * 경매 물품은 비싸도 수십만 골드라 아홉 자리면 넉넉하다. 그보다 길게 두면 곱셈이
 * 정수 정밀도(2^53)에 가까워진다.
 */
const MAX_DIGITS = 9;

/**
 * 손익분기점. 이 값에 낙찰받으면 분배금만 받는 것과 똑같다.
 *
 * 내린다. 올리면 분기점이라고 알려준 값에 사서 1골드를 잃는다.
 */
export function breakEvenPrice(price: number, size: AuctionPartySize): number {
  return Math.floor((price * 95 * (size - 1)) / (size * 100));
}

/**
 * 입찰 적정가. 손익분기점의 0.91배다.
 *
 * `breakEvenPrice`를 받아 곱하지 않는다. 분기점을 먼저 내리고 곱하면 내림이 두 번
 * 걸려 1골드씩 어긋나는 시세가 있다(10,001 4인: 6,484가 6,483이 된다).
 *
 * 소수를 곱하지 않고 정수로 푼다. `108000 * 0.95`부터 이미 정확히 떨어지지 않아,
 * 70,024.5 같은 경계에서 내림이 한 칸 어긋날 수 있다.
 */
export function bidPrice(price: number, size: AuctionPartySize): number {
  return Math.floor((price * 95 * (size - 1) * 91) / (size * 10_000));
}

/** 세 자리마다 끊는다. 로케일 자료를 타지 않게 직접 넣는다(scoreCut.ts와 같은 이유). */
export function formatGold(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+$)/g, GOLD_SEPARATOR);
}

/** 글자에서 숫자만. */
function digitsOf(text: string): string {
  return text.replace(/[^0-9]/g, "");
}

/**
 * 입력 칸에 남길 글자. 숫자만 남기고 세 자리마다 끊는다.
 *
 * 앞의 0은 버린다. 남겨 두면 자릿수 제한이 0에 먹혀 실제 숫자가 잘린다.
 */
export function formatGoldInput(value: string): string {
  const digits = digitsOf(value).replace(/^0+/, "").slice(0, MAX_DIGITS);
  return digits ? formatGold(Number(digits)) : "";
}

/** 칸의 글자를 값으로. 비었으면 `null`이다. */
export function parseGold(text: string): number | null {
  const digits = digitsOf(text);
  return digits ? Number(digits) : null;
}

/** 캐럿 앞에 숫자가 몇 개인가. */
export function goldDigitCount(text: string): number {
  return digitsOf(text).length;
}

/**
 * 앞에서부터 숫자 `count`개를 지난 자리.
 *
 * 콤마가 붙거나 빠지면 글자 수가 달라져 캐럿을 글자 수로 되돌리면 한 칸씩 밀린다.
 * 숫자 개수로 되돌린다(scoreCut.ts의 `scoreCutCaret`과 같다).
 */
export function goldCaret(text: string, count: number): number {
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

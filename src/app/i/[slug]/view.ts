/**
 * 편성표 보기 방식.
 *
 * 카드는 초상·각인·아크그리드까지 보여주지만 8인이 두 줄로 갈린다. 편성을 짤 때는
 * 여덟을 한눈에 놓고 시너지를 맞추는 편이 빠르다. 그래서 두 가지를 둔다.
 *
 * 테마와 같은 이유로 **쿠키에 담는다.** 서버가 첫 HTML부터 맞는 화면을 그리면
 * 카드로 한 번 그렸다가 표로 바뀌는 깜빡임이 없다.
 */
export const BOARD_VIEW_COOKIE = "loa_board_view";

const MAX_AGE = 60 * 60 * 24 * 365;

export type BoardView = "compact" | "full";

export function toBoardView(value: string | undefined | null): BoardView {
  return value === "compact" ? "compact" : "full";
}

export function applyBoardView(view: BoardView) {
  document.cookie = `${BOARD_VIEW_COOKIE}=${view}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

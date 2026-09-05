/**
 * 테마 저장은 쿠키다.
 *
 * 예전에는 localStorage에 넣고 <head>의 인라인 스크립트가 첫 페인트 전에 읽었다.
 * 그 방식은 서버가 테마를 모르기 때문에 스크립트 없이는 기본 색이 한 번 번쩍인다.
 * 그런데 React 트리 안의 <script>는 클라이언트에서 다시 그려질 때
 * "스크립트는 실행되지 않는다"는 콘솔 오류를 낸다(router.refresh 등).
 *
 * 쿠키면 서버가 첫 HTML에 data-theme을 직접 박을 수 있어 스크립트도 번쩍임도 없다.
 */
export const THEME_COOKIE = "loa_theme";

/** 1년. 브라우저를 닫아도 남아야 한다. */
const MAX_AGE = 60 * 60 * 24 * 365;

export type ThemeChoice = "system" | "light" | "dark";

/** 쿠키 값에서 읽는다. 서버·클라이언트 양쪽에서 쓴다. */
export function toThemeChoice(value: string | undefined | null): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  // 서버가 다음 요청부터 같은 테마로 그리도록 남긴다. 지금 화면은 위에서 이미 바뀌었다.
  const base = `${THEME_COOKIE}=`;
  document.cookie =
    choice === "system"
      ? `${base}; path=/; max-age=0; samesite=lax`
      : `${base}${choice}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

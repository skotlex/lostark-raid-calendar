export const THEME_STORAGE_KEY = "loa-raid-board:theme";

export type ThemeChoice = "system" | "light" | "dark";

/**
 * 첫 페인트 전에 실행되는 스크립트.
 *
 * React가 붙기를 기다리면 저장된 테마가 적용되기 전에 기본 색이 한 번 번쩍인다.
 * 그래서 <head>에 인라인으로 넣어 동기 실행한다.
 *
 * 문자열로 두는 이유는 dangerouslySetInnerHTML에 그대로 넣기 위해서다.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {
    // 저장소 접근이 막힌 브라우저에서는 시스템 설정을 따른다.
  }
})();
`;

export function readTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  try {
    if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // 저장이 막혀도 이번 세션 동안은 적용된 상태로 남는다.
  }
}

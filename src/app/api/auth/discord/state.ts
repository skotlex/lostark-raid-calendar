/**
 * 로그인 왕복 동안만 쓰는 값. 라우트 둘이 함께 쓴다.
 *
 * `_`로 시작하는 폴더가 아니라 파일이므로 라우팅 대상이 아니다.
 * (route.ts / page.tsx 같은 약속된 이름만 라우트가 된다)
 */

export const OAUTH_COOKIE = "loa_oauth";

/**
 * 로그인 후 돌아갈 곳. **반드시 우리 사이트 안의 경로여야 한다.**
 * 검사 없이 그대로 쓰면 열린 리다이렉트가 되어 피싱에 쓰인다.
 */
export function safeNext(value: string | null): string {
  if (!value) return "/";
  // "//evil.com"은 프로토콜 상대 URL이라 바깥으로 나간다. 슬래시 하나만 허용한다.
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function packOAuthCookie(state: string, next: string): string {
  return `${state}|${next}`;
}

export function unpackOAuthCookie(raw: string | undefined): { state: string; next: string } | null {
  if (!raw) return null;
  const bar = raw.indexOf("|");
  if (bar <= 0) return null;
  return { state: raw.slice(0, bar), next: safeNext(raw.slice(bar + 1)) };
}

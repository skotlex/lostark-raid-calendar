import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * 입장 세션.
 *
 * 디스코드 길드 멤버임을 확인한 결과를 서명 쿠키로 들고 다닌다(CLAUDE.md 4장).
 * DB에 세션 테이블을 두지 않는 이유는 페이지마다 조회가 한 번씩 더 늘기 때문이다.
 * 서명만으로 위조를 막을 수 있고, 무효화가 필요하면 비밀키를 바꾸면 된다.
 *
 * **쿠키는 위조는 못 해도 훔칠 수는 있다.** 그래서 담는 값은 신원 표시용뿐이고,
 * 권한이랄 것이 애초에 없다(입장한 사람은 누구나 편집한다).
 */

const COOKIE = "loa_session";
/** 30일. 매주 여는 화면이라 이보다 짧으면 성가시다. */
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

export interface Session {
  /** 디스코드 사용자 ID. Member와 잇는 키다. */
  discordUserId: string;
  /** 화면과 기록에 남길 이름. 길드 닉네임을 우선한다. */
  label: string;
  /** 디스코드 아바타 URL. 없을 수 있다. */
  avatarUrl: string | null;
  /** 만료 시각(초). 서명 안에 넣어야 늘려치기를 막는다. */
  exp: number;
}

function secret(): string {
  const value = process.env.INSTANCE_SESSION_SECRET;
  if (!value) throw new Error("INSTANCE_SESSION_SECRET이 없다");
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** 서명 비교는 반드시 상수 시간으로 한다. 길이가 다르면 비교 자체가 던진다. */
function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function encodeSession(session: Session): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = raw.slice(0, dot);
  if (!sameSignature(raw.slice(dot + 1), sign(body))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (typeof parsed.discordUserId !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 지금 요청의 세션. 없으면 null이다. */
export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE)?.value);
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE_SEC = MAX_AGE_SEC;

/**
 * 입장한 사람만 지나간다. 아니면 로그인 화면으로 보낸다.
 *
 * **여기가 실제 관문이다.** proxy로 막지 않는 이유는 Next 문서가 proxy를
 * "완전한 세션 관리·인가 수단이 아니다"라고 못 박기 때문이다. 서버 컴포넌트와
 * 서버 액션에서 각각 확인해야 우회가 없다.
 */
export async function requireSession(next?: string): Promise<Session> {
  const session = await readSession();
  if (session) return session;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}

/** 쿠키에 실을 옵션. 로그인·로그아웃 라우트가 함께 쓴다. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // 로컬 개발은 http라 secure를 켜면 쿠키가 아예 저장되지 않는다.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

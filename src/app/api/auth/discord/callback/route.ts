import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { DiscordError, exchangeCode, fetchGuildMember } from "@/lib/discord";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  encodeSession,
  sessionCookieOptions,
} from "@/lib/session";

import { OAUTH_COOKIE, unpackOAuthCookie } from "../state";

/**
 * 디스코드가 되돌려 보내는 곳.
 *
 * 순서가 중요하다. state를 먼저 대조하고, 그다음 코드를 토큰으로 바꾸고,
 * **마지막에 길드 멤버인지 확인한다.** 멤버가 아니면 세션을 굽지 않는다.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  const pending = unpackOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const fail = (reason: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", reason);
    const res = NextResponse.redirect(url);
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  };

  // 사용자가 동의 화면에서 취소했을 때도 여기로 온다.
  if (params.get("error")) return fail("cancelled");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !pending) return fail("state");
  if (!sameState(state, pending.state)) return fail("state");

  try {
    const token = await exchangeCode(origin, code);
    const member = await fetchGuildMember(token);
    if (!member) return fail("not_member");

    const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
    const res = NextResponse.redirect(new URL(pending.next, origin));
    res.cookies.set(
      SESSION_COOKIE,
      encodeSession({
        discordUserId: member.discordUserId,
        label: member.label,
        avatarUrl: member.avatarUrl,
        exp,
      }),
      sessionCookieOptions(SESSION_MAX_AGE_SEC),
    );
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch (error) {
    // 디스코드 쪽 문제와 "길드에 없다"를 같은 화면으로 보여주지 않는다.
    if (error instanceof DiscordError) return fail("discord");
    throw error;
  }
}

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

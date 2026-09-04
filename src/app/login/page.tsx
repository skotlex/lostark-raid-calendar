import { redirect } from "next/navigation";

import { readSession } from "@/lib/session";
import { safeNext } from "../api/auth/discord/state";

export const dynamic = "force-dynamic";

/**
 * 입장 화면.
 *
 * 길드 디스코드 서버의 멤버만 들어온다(CLAUDE.md 4장). 암호를 공유하지 않아도 되고,
 * 길드를 나가면 접근이 저절로 끊긴다.
 */

const MESSAGES: Record<string, string> = {
  not_member: "길드 디스코드 서버의 멤버가 아닙니다. 서버에 들어온 뒤 다시 시도해 주세요.",
  cancelled: "디스코드에서 취소했습니다.",
  state: "로그인 요청이 만료됐습니다. 다시 시도해 주세요.",
  discord: "디스코드와 통신하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  const next = safeNext(typeof query.next === "string" ? query.next : null);

  // 이미 들어와 있으면 로그인 화면을 보여줄 이유가 없다.
  if (await readSession()) redirect(next);

  const error = typeof query.error === "string" ? MESSAGES[query.error] : undefined;

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center">
        <h1 className="text-lg font-bold">길드 레이드 편성표</h1>
        <p className="mt-2 text-sm text-text-dim">
          길드 디스코드 서버의 멤버만 들어올 수 있습니다.
        </p>

        {error && (
          <p className="mt-4 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-left text-xs text-danger">
            {error}
          </p>
        )}

        <a
          href={`/api/auth/discord?next=${encodeURIComponent(next)}`}
          className="mt-5 flex items-center justify-center gap-2 rounded bg-[#5865F2] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {/* 디스코드 마크. 브랜드 색 위에 흰색으로 얹는다. */}
          <svg viewBox="0 0 24 18" className="h-4 w-5" fill="currentColor" aria-hidden>
            <path d="M20.3 1.6A19.8 19.8 0 0 0 15.4.1a13.8 13.8 0 0 0-.6 1.3 18.3 18.3 0 0 0-5.5 0A13.7 13.7 0 0 0 8.6.1a19.7 19.7 0 0 0-5 1.5C.5 6.3-.3 10.9.1 15.4a19.9 19.9 0 0 0 6 3 14.7 14.7 0 0 0 1.3-2.1 12.9 12.9 0 0 1-2-1c.2-.1.3-.2.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a12.9 12.9 0 0 1-2 1 14.5 14.5 0 0 0 1.3 2.1 19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.8-3.6-13.8ZM8 12.6c-1.2 0-2.2-1.1-2.2-2.4S6.8 7.7 8 7.7s2.2 1.1 2.2 2.5-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.5 2.2-2.5 2.2 1.1 2.2 2.5-1 2.4-2.2 2.4Z" />
          </svg>
          디스코드로 입장
        </a>
      </div>
    </main>
  );
}

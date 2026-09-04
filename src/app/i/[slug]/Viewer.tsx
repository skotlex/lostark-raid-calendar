import Image from "next/image";

import type { Session } from "@/lib/session";

/**
 * 지금 들어와 있는 사람.
 *
 * 예전에는 "내 이름"을 직접 치게 했다. 검증되지 않는 값이라 비워둘 수도, 남의 이름을
 * 적을 수도 있었고 브라우저를 바꾸면 사라졌다. 이제 디스코드 길드 닉네임이 그 자리를
 * 대신한다(CLAUDE.md 4장).
 */
export function Viewer({ session }: { session: Session }) {
  return (
    <div className="flex items-center gap-2">
      {session.avatarUrl ? (
        <Image
          src={session.avatarUrl}
          alt=""
          width={24}
          height={24}
          className="rounded-full"
          unoptimized
        />
      ) : (
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[11px] text-text-dim"
          aria-hidden
        >
          {session.label.slice(0, 1)}
        </span>
      )}

      <span className="max-w-28 truncate text-sm" title={session.label}>
        {session.label}
      </span>

      {/* GET으로 두면 링크 미리보기만으로도 로그아웃된다. 폼으로 POST한다. */}
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          title="로그아웃"
          className="rounded border border-border px-2 py-1 text-xs text-text-faint transition-colors hover:text-text"
        >
          나가기
        </button>
      </form>
    </div>
  );
}

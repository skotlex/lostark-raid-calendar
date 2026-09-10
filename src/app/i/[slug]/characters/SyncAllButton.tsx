"use client";

import { syncAllAction } from "./actions";
import { useBatchSync } from "./batchSync";

/**
 * 등록된 캐릭터를 한 번에 다시 조회한다.
 *
 * 스펙 갱신도 되지만 본래 목적은 **표시 형식이 바뀌었을 때 옛 데이터를 되살리는 것**이다.
 * 저장된 값은 조회 시점의 형식으로 굳어 있어 코드만 고쳐서는 바뀌지 않는다.
 *
 * 캐릭터마다 요청 1회라 200개면 분당 한도에 걸려 몇 분이 걸린다. 서버 한 번으로는
 * 실행 시간 제한에 잘리므로 회차를 나눠 부르고, 그 김에 어디까지 갔는지 보여준다
 * (batchSync.ts).
 *
 * **여기는 길드 전체다.** 자기 원정대만 되살리려는 사람은 그 묶음의 갱신 버튼을
 * 쓴다(SyncRosterButton).
 */
export function SyncAllButton({ slug, count }: { slug: string; count: number }) {
  const { running, done, message, failed, run } = useBatchSync((startedAt) =>
    syncAllAction(slug, startedAt),
  );

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={running}
        title="캐릭터마다 API를 한 번씩 부릅니다. 많으면 시간이 걸립니다"
        className="rounded border border-border px-2 py-1 text-xs text-text-dim transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
      >
        {running ? `갱신 중… (${done}/${count})` : "전체 갱신"}
      </button>
      {message && (
        <span className={`text-xs ${failed ? "text-danger" : "text-ok"}`}>{message}</span>
      )}
    </div>
  );
}

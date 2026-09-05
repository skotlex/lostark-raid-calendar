"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { syncAllAction } from "./actions";

/**
 * 등록된 캐릭터를 한 번에 다시 조회한다.
 *
 * 스펙 갱신도 되지만 본래 목적은 **표시 형식이 바뀌었을 때 옛 데이터를 되살리는 것**이다.
 * 저장된 값은 조회 시점의 형식으로 굳어 있어 코드만 고쳐서는 바뀌지 않는다.
 *
 * 캐릭터마다 요청 1회라 200개면 분당 한도에 걸려 몇 분이 걸린다. 서버 한 번으로는
 * 실행 시간 제한에 잘리므로 회차를 나눠 부르고, 그 김에 어디까지 갔는지 보여준다.
 *
 * 진행률은 회차가 돌아올 때만 움직인다. 회차 크기는 서버가 정한다
 * (characters.ts의 `SYNC_ALL_BATCH`).
 */
export function SyncAllButton({ slug, count }: { slug: string; count: number }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  if (count === 0) return null;

  async function run() {
    setRunning(true);
    setDone(0);
    setMessage("");
    setFailed(false);

    // 이 시각보다 먼저 갱신된 캐릭터가 이번 회차의 대상이다. 회차마다 그대로 넘긴다.
    const startedAt = new Date().toISOString();
    let ok = 0;
    let bad = 0;

    try {
      for (;;) {
        const progress = await syncAllAction(slug, startedAt);
        ok += progress.added.length;
        bad += progress.failed.length;
        setDone(ok + bad);
        if (progress.remaining === 0) break;
        // 한 회차에서 아무것도 못 했는데 남아 있으면 더 부르지 않는다. 무한히 돌 수 있다.
        if (progress.added.length + progress.failed.length === 0) {
          // 끝까지 못 갔으므로 서버가 화면을 다시 그리지 않았다. 여기까지 한 것은 보여준다.
          router.refresh();
          break;
        }
      }

      const parts = [`${ok}개 갱신됨`];
      if (bad > 0) parts.push(`${bad}개 실패`);
      setMessage(parts.join(" / "));
    } catch {
      setFailed(true);
      setMessage("갱신하지 못했습니다");
      // 중간에 끊겨도 앞 회차가 갱신한 것은 남아 있다.
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

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

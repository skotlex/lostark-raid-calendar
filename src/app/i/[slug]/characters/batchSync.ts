"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// characters.ts는 server-only다. 타입만 가져온다.
import type { BulkProgress } from "@/lib/characters";

/**
 * 회차를 이어 부르며 어디까지 갔는지 들고 있는다.
 *
 * 전체 갱신과 원정대 갱신이 같은 구조를 쓴다. 캐릭터마다 요청 1회라 한 번의 서버
 * 호출로는 실행 시간 제한에 잘리고, 그래서 서버가 회차를 나눠 돌려준다. 범위만
 * 다르고 이어 부르는 방법은 같아서 여기 한곳에 둔다.
 *
 * 진행률은 회차가 돌아올 때만 움직인다. 회차 크기는 서버가 정한다
 * (characters.ts의 `SYNC_ALL_BATCH`).
 */
export function useBatchSync(batch: (startedAt: string) => Promise<BulkProgress>) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();

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
        const progress = await batch(startedAt);
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

  return { running, done, message, failed, run };
}

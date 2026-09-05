"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";



/**
 * 오래된 캐릭터 스펙을 화면이 열릴 때 알아서 갱신한다.
 *
 * 예전에는 카드에 "갱신을 눌러 주세요"가 떴다. 아무도 누르지 않으면 낡은 숫자가 그대로
 * 편성 근거가 되는데, 그건 이 앱이 없애려던 시트의 문제와 같다.
 *
 * 조회는 캐릭터마다 요청 1회라 몇 초씩 걸린다. 렌더를 막지 않고 뒤에서 돌린 뒤
 * 끝나면 화면만 다시 그린다. 갱신할 것이 없으면 아무 일도 하지 않는다.
 *
 * **서버 액션이 아니라 라우트를 부른다.** 액션으로 두면 React가 폼 동작과 같은 줄에
 * 세워서, 갱신이 도는 동안 사용자가 누른 삭제·등록이 그 뒤에 밀린다. 화면은 멀쩡한데
 * 아무 반응이 없는 것처럼 보인다(api/sync-stale).
 */
export function AutoSync({ slug, staleCount }: { slug: string; staleCount: number }) {
  const router = useRouter();
  // 한 번만 부른다. 갱신 뒤 다시 그려질 때 또 부르면 서로를 부르는 고리가 된다.
  const started = useRef(false);

  useEffect(() => {
    if (staleCount === 0 || started.current) return;
    started.current = true;

    let alive = true;
    fetch("/api/sync-stale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    })
      .then((res) => (res.ok ? res.json() : { synced: 0 }))
      .then((result: { synced?: number }) => {
        if (alive && (result.synced ?? 0) > 0) router.refresh();
      })
      // 갱신은 곁다리다. 실패해도 화면은 지금 값 그대로 두고 조용히 넘어간다.
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [slug, staleCount, router]);

  return null;
}

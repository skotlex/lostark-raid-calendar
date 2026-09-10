"use client";

import { syncRosterAction } from "./actions";
import { useBatchSync } from "./batchSync";

/**
 * 원정대 하나만 다시 조회한다. 원정대 삭제 옆에 선다.
 *
 * 전체 갱신은 길드 전원을 돌아 몇 분이 걸린다. 부캐 스펙을 바꾸고 온 사람이 자기
 * 원정대만 되살리려고 그 시간을 기다릴 이유가 없고, 남의 캐릭터까지 분당 한도를
 * 축낼 이유도 없다.
 *
 * **삭제 버튼과 같은 무리를 집는다.** 탭이 서 있으면 지금 보고 있는 원정대, 없으면
 * 그 사람 캐릭터 전부다. 같은 자리에 나란히 서는 버튼이 서로 다른 범위를 잡으면
 * 무엇에 눌리는 버튼인지 자리로 읽을 수 없게 된다.
 */
export function SyncRosterButton({
  slug,
  label,
  rosterId,
  count,
  tabbed = false,
}: {
  slug: string;
  /** 사람 이름. 서버가 이 사람의 원정대가 맞는지 다시 확인한다 */
  label: string;
  /** Roster.id. 원정대 미지정 묶음은 빈 문자열이다 */
  rosterId: string;
  count: number;
  /** 원정대 탭이 서 있는 묶음인가. 버튼 이름을 가르는 데만 쓴다 */
  tabbed?: boolean;
}) {
  const { running, done, message, failed, run } = useBatchSync((startedAt) =>
    syncRosterAction(slug, startedAt, label, rosterId),
  );

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={running}
        title="이 원정대의 캐릭터만 다시 조회합니다. 캐릭터마다 API를 한 번씩 부릅니다"
        className="rounded border border-border px-2 py-0.5 text-xs font-normal text-text-faint transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
      >
        {running ? `갱신 중… (${done}/${count})` : tabbed ? "이 원정대 갱신" : "일괄 갱신"}
      </button>
      {message && (
        <span className={`text-xs font-normal ${failed ? "text-danger" : "text-ok"}`}>
          {message}
        </span>
      )}
    </div>
  );
}

"use client";

import { HISTORY_PERIODS, type HistoryPeriod } from "@/lib/historyPeriod";

/**
 * 기간 고르기.
 *
 * **고르는 순간 곧바로 찾는다.** 드롭다운은 고르는 것으로 끝났다고 느끼는 칸이라,
 * 옆의 `검색`을 한 번 더 눌러야 하면 화면이 안 바뀌는 것처럼 보인다. 글자를 치는
 * 칸(q)은 반대다 — 다 치기 전에 보낼 수 없어 버튼이 필요하다.
 *
 * 폼을 직접 제출한다. 주소를 손으로 만들어 router로 미는 방법도 있지만, 그러면
 * 같은 화면의 두 곳이 주소를 따로 조립하게 되어 q를 실어 보내는 것을 한쪽에서만
 * 빠뜨리기 쉽다. requestSubmit은 next/form이 가로채 그대로 클라이언트 이동이 된다.
 */
export function PeriodSelect({ value }: { value: HistoryPeriod }) {
  return (
    <select
      name="d"
      defaultValue={value}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded border border-border bg-surface px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      aria-label="기간"
    >
      {HISTORY_PERIODS.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

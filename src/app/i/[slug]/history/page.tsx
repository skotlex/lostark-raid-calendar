import { listHistory } from "@/lib/history";
import { requireInstance } from "@/lib/instance";

export const dynamic = "force-dynamic";

/**
 * 화면에 뿌리는 시각은 언제나 KST다. 레이드 시간이 그 기준이다.
 *
 * ko-KR 기본값은 "오후 07:42"라 24시 표기로 못 박는다. 요일표의 시간이 20:00 형식이라
 * 둘을 나란히 볼 때 머릿속에서 변환하지 않아도 된다.
 */
const TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hourCycle: "h23",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "full",
});

export default async function HistoryPage({ params }: PageProps<"/i/[slug]/history">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);
  const entries = await listHistory(instance.id);

  // 날짜별로 묶는다. 200줄이 한 덩어리로 쏟아지면 언제 일인지 세어야 한다.
  const days = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = DAY.format(new Date(entry.createdAt));
    const list = days.get(key);
    if (list) list.push(entry);
    else days.set(key, [entry]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">편집 이력</h1>
        <p className="mt-1 text-sm text-text-dim">
          편성표와 요일표에서 일어난 변경을 최근 것부터 보여줍니다. 누구나 서로의 편성을
          고칠 수 있으므로, 막는 대신 무엇이 바뀌었는지 남깁니다.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          아직 기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-5">
          {[...days.entries()].map(([day, list]) => (
            <section key={day} className="space-y-1.5">
              <h2 className="text-sm font-semibold">{day}</h2>
              <ul className="divide-y divide-border rounded border border-border bg-surface">
                {list.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 text-sm"
                  >
                    <span className="w-24 shrink-0 text-xs text-text-faint tabular">
                      {TIME.format(new Date(entry.createdAt))}
                    </span>
                    <span className="shrink-0 text-xs text-text-dim">
                      {entry.actorLabel ?? "누군가"}
                    </span>
                    <span className="min-w-0 flex-1">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

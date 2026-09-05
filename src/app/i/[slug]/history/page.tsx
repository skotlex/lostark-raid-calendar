import Form from "next/form";
import Link from "next/link";

import { HISTORY_PAGE_SIZE, listHistory } from "@/lib/history";
import { requireInstance } from "@/lib/instance";

export const dynamic = "force-dynamic";

/**
 * 화면에 뿌리는 시각은 언제나 KST다. 레이드 시간이 그 기준이다.
 *
 * ko-KR 기본값은 "오후 07:42"라 24시 표기로 못 박는다. 요일표의 시간이 20:00 형식이라
 * 둘을 나란히 볼 때 머릿속에서 변환하지 않아도 된다.
 *
 * 날짜는 넣지 않는다. 줄을 날짜별로 묶어 제목에 이미 적혀 있다.
 */
const TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "full",
});

export default async function HistoryPage({
  params,
  searchParams,
}: PageProps<"/i/[slug]/history">) {
  const { slug } = await params;
  const query = await searchParams;
  const instance = await requireInstance(slug);

  // 범위를 벗어난 값은 listHistory가 안쪽으로 당겨서 돌려준다. 여기서는 숫자로만 만든다.
  const asked = Number(typeof query.page === "string" ? query.page : "1");
  const q = (typeof query.q === "string" ? query.q : "").trim();
  const { entries, page, pageCount, total } = await listHistory(instance.id, {
    page: asked,
    query: q,
  });

  // 날짜별로 묶는다. 100줄이 한 덩어리로 쏟아지면 언제 일인지 세어야 한다.
  const days = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = DAY.format(new Date(entry.createdAt));
    const list = days.get(key);
    if (list) list.push(entry);
    else days.set(key, [entry]);
  }

  // 쪽을 넘겨도 찾던 말은 그대로 들고 간다. 빠뜨리면 2쪽에서 검색이 풀린다.
  const href = (p: number) =>
    `/i/${slug}/history?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  // 이 쪽이 전체에서 몇 번째 줄들인지. "3 / 12"만으로는 얼마나 뒤로 온 것인지 모른다.
  const first = (page - 1) * HISTORY_PAGE_SIZE + 1;
  const last = Math.min(page * HISTORY_PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">편집 이력</h1>
        <p className="mt-1 text-sm text-text-dim">
          편성표와 요일표에서 일어난 변경을 최근 것부터 보여줍니다. 누구나 서로의 편성을
          고칠 수 있으므로, 막는 대신 무엇이 바뀌었는지 남깁니다.
        </p>
      </div>

      {/*
        검색.

        next/form이라 눌러도 화면 전체가 다시 뜨지 않는다. 평범한 <form method="get">은
        브라우저 통째 이동이라 머리줄까지 다시 그린다.

        쪽 번호는 넘기지 않는다. 찾는 말이 바뀌면 결과도 달라져 3쪽이라는 값이 뜻을
        잃는다. 늘 1쪽부터 본다.
      */}
      <Form action={`/i/${slug}/history`} className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="캐릭터·레이드·사람 이름, 또는 배치·고정 같은 동작"
          className="min-w-0 flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-border bg-surface-2 px-3 py-1.5 text-sm"
        >
          검색
        </button>
        {q && (
          <Link
            href={`/i/${slug}/history`}
            className="rounded px-2 py-1.5 text-sm text-text-dim hover:underline"
          >
            지우기
          </Link>
        )}
      </Form>

      {q && (
        <p className="text-sm text-text-dim">
          <span className="text-text">{q}</span> 검색 결과 {total}건
        </p>
      )}

      {entries.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          {q ? "찾는 기록이 없습니다." : "아직 기록이 없습니다."}
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
                    <span className="w-10 shrink-0 text-xs text-text-faint tabular">
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

      {/*
        쪽 넘김. 한 쪽뿐이면 세우지 않는다 — 넘길 곳이 없는 화살표는 무엇을 더 볼 수
        있는지에 대해 아무것도 말해주지 않는다.

        화살표는 편성표의 주차 이동과 같은 모양이다(.week-arrow). 둘 다 "같은 화면을
        앞뒤로 넘기는" 동작이라 다르게 생길 이유가 없다. 끝에서는 Link 대신 span으로
        내려 눌러도 아무 일이 없는 자리를 만들지 않는다.
      */}
      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className="week-arrow" aria-label="이전 쪽">
              ‹
            </Link>
          ) : (
            <span className="week-arrow opacity-30" aria-hidden>
              ‹
            </span>
          )}
          <span className="px-1 text-xs text-text-dim tabular">
            {page} / {pageCount}
            <span className="ml-2 text-text-faint">
              {first}–{last} / {total}
            </span>
          </span>
          {page < pageCount ? (
            <Link href={href(page + 1)} className="week-arrow" aria-label="다음 쪽">
              ›
            </Link>
          ) : (
            <span className="week-arrow opacity-30" aria-hidden>
              ›
            </span>
          )}
        </nav>
      )}
    </div>
  );
}

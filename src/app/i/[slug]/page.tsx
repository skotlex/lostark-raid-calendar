import Link from "next/link";

import { getBoard } from "@/lib/board";
import { prisma } from "@/lib/prisma";
import { requireInstance } from "@/lib/instance";
import { requireSession } from "@/lib/session";
import {
  WEEK_DAYS,
  addWeeks,
  dayNameFull,
  formatWeekLabel,
  getWeekStart,
  isCurrentWeek,
  parseDayParam,
  parseWeekParam,
  toWeekParam,
} from "@/lib/week";

import { AutoSync } from "./AutoSync";
import { KnownNamesProvider } from "./NameInput";
import { RememberDay } from "./lastDay";
import { SlotCard } from "./SlotCard";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
  searchParams,
}: PageProps<"/i/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const instance = await requireInstance(slug);
  const session = await requireSession(`/i/${slug}`);

  const weekStart = parseWeekParam(
    typeof query.week === "string" ? query.week : undefined,
  );
  const day = parseDayParam(typeof query.day === "string" ? query.day : undefined);
  const week = toWeekParam(weekStart);

  // 지난 주는 읽기 전용이다. 기록을 나중에 고쳐 쓰지 못하게 한다.
  const editable = isCurrentWeek(weekStart);

  const board = await getBoard(instance.id, weekStart, session.label);
  const slots = board.filter((slot) => slot.dayOfWeek === day);

  // 칸 입력의 자동완성 목록. 이미 등록된 캐릭터는 API를 다시 부르지 않는다.
  // 컨텍스트로 한 번만 실어 보낸다. 칸마다 넘기면 같은 목록이 칸 수만큼 직렬화된다.
  const known = await prisma.character.findMany({
    where: { instanceId: instance.id },
    select: { name: true },
    orderBy: { itemLevel: "desc" },
  });
  const knownNames = known.map((c) => c.name);

  // 편성에 들어와 있는 캐릭터 중 스펙이 오래된 것. 있으면 화면이 열린 뒤 알아서 갱신된다.
  const stale = new Set<string>();
  for (const slot of board) {
    for (const party of slot.parties) {
      for (const cell of party.cells) {
        if (cell.character?.stale && !cell.character.syncError) stale.add(cell.character.id);
      }
    }
  }

  const countByDay = new Map<number, number>();
  for (const slot of board) {
    countByDay.set(slot.dayOfWeek, (countByDay.get(slot.dayOfWeek) ?? 0) + 1);
  }

  function href(next: { day?: number; week?: string }) {
    const d = next.day ?? day;
    const w = next.week ?? week;
    return `/i/${slug}?day=${d}&week=${w}`;
  }

  return (
    <div className="space-y-4">
      {/* 다른 화면에 갔다 돌아왔을 때 보던 요일로 열리게 한다. */}
      <RememberDay day={day} />
      <AutoSync slug={slug} staleCount={stale.size} />

      {/* 밑줄이 놓일 레일. 이게 없으면 켜진 탭의 밑줄만 허공에 떠 보인다. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border">
        <nav className="flex flex-wrap">
          {WEEK_DAYS.map((d) => {
            const count = countByDay.get(d) ?? 0;
            return (
              <Link
                key={d}
                href={href({ day: d })}
                className="day-tab"
                data-active={d === day}
                aria-current={d === day ? "page" : undefined}
              >
                {dayNameFull(d)}
                {count > 0 && (
                  <span className="day-badge" title={`레이드 ${count}개`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 pb-1.5 text-sm">
          <Link
            href={href({ week: toWeekParam(addWeeks(weekStart, -1)) })}
            className="week-arrow"
          >
            ‹
          </Link>
          <span className="px-1 text-xs text-text-dim tabular">
            {formatWeekLabel(weekStart)}
          </span>
          <Link
            href={href({ week: toWeekParam(addWeeks(weekStart, 1)) })}
            className="week-arrow"
          >
            ›
          </Link>
          {!editable && (
            <Link
              href={href({ week: toWeekParam(getWeekStart()) })}
              className="ml-1 rounded bg-accent/15 px-2 py-1 text-xs text-accent"
            >
              이번 주로
            </Link>
          )}
        </div>
      </div>

      {!editable && (
        <p className="rounded border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
          지난 주 편성입니다. 기록으로만 보여주며 고칠 수 없습니다.
        </p>
      )}

      {slots.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          {dayNameFull(day)}에 등록된 레이드가 없습니다.
          <br />
          <Link href={`/i/${slug}/slots`} className="text-accent hover:underline">
            요일표 편집에서 레이드를 추가해 주세요
          </Link>
        </div>
      ) : (
        <KnownNamesProvider names={knownNames}>
          <div className="space-y-4">
            {slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slug={slug}
                week={week}
                slot={slot}
                editable={editable}
              />
            ))}
          </div>
        </KnownNamesProvider>
      )}
    </div>
  );
}

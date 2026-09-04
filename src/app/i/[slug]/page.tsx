import Link from "next/link";

import { getBoard } from "@/lib/board";
import { prisma } from "@/lib/prisma";
import { requireInstance } from "@/lib/instance";
import {
  addWeeks,
  dayName,
  formatWeekLabel,
  isCurrentWeek,
  parseDayParam,
  parseWeekParam,
  toWeekParam,
} from "@/lib/week";

import { RememberDay } from "./lastDay";
import { SlotCard } from "./SlotCard";

export const dynamic = "force-dynamic";

const DAYS = [0, 1, 2, 3, 4, 5, 6];

export default async function BoardPage({
  params,
  searchParams,
}: PageProps<"/i/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const instance = await requireInstance(slug);

  const weekStart = parseWeekParam(
    typeof query.week === "string" ? query.week : undefined,
  );
  const day = parseDayParam(typeof query.day === "string" ? query.day : undefined);
  const week = toWeekParam(weekStart);

  // 지난 주는 읽기 전용이다. 기록을 나중에 고쳐 쓰지 못하게 한다.
  const editable = isCurrentWeek(weekStart);

  const board = await getBoard(instance.id, weekStart);
  const slots = board.filter((slot) => slot.dayOfWeek === day);

  // 칸 입력의 자동완성 목록. 이미 등록된 캐릭터는 API를 다시 부르지 않는다.
  const known = await prisma.character.findMany({
    where: { instanceId: instance.id },
    select: { name: true },
    orderBy: { itemLevel: "desc" },
  });
  const knownNames = known.map((c) => c.name);

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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav className="flex flex-wrap gap-1">
          {DAYS.map((d) => {
            const count = countByDay.get(d) ?? 0;
            return (
              <Link
                key={d}
                href={href({ day: d })}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  d === day
                    ? "bg-accent/15 font-semibold text-accent"
                    : "text-text-dim hover:bg-surface-2 hover:text-text"
                }`}
              >
                {dayName(d)}
                {count > 0 && <span className="ml-1 text-xs text-text-faint tabular">{count}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link
            href={href({ week: toWeekParam(addWeeks(weekStart, -1)) })}
            className="rounded border border-border px-2 py-1 text-text-dim hover:text-text"
          >
            ‹
          </Link>
          <span className="px-1 text-xs text-text-dim tabular">
            {formatWeekLabel(weekStart)}
          </span>
          <Link
            href={href({ week: toWeekParam(addWeeks(weekStart, 1)) })}
            className="rounded border border-border px-2 py-1 text-text-dim hover:text-text"
          >
            ›
          </Link>
          {!editable && (
            <Link
              href={href({ week: undefined })}
              className="ml-1 rounded bg-accent/15 px-2 py-1 text-xs text-accent"
            >
              이번 주로
            </Link>
          )}
        </div>
      </div>

      {!editable && (
        <p className="rounded border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
          지난 주 편성이다. 기록으로만 보여주며 고칠 수 없다.
        </p>
      )}

      {slots.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          {dayName(day)}요일에 등록된 레이드가 없다.
          <br />
          <Link href={`/i/${slug}/slots`} className="text-accent hover:underline">
            요일표 편집에서 레이드를 추가한다
          </Link>
        </div>
      ) : (
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
      )}

      {/* 모든 칸이 공유하는 자동완성 목록. 칸마다 만들면 DOM이 무거워진다. */}
      <datalist id={`chars-${slug}`}>
        {knownNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}

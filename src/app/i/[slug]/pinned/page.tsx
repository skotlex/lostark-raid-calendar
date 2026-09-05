import Link from "next/link";

import { listPinned } from "@/lib/board";
import { requireInstance } from "@/lib/instance";
import { positionLabel } from "@/lib/positions";
import { dayNameFull, getWeekStart, toWeekParam } from "@/lib/week";

import { KeepRosterOffButton, UnpinButton } from "./PinnedControls";

export const dynamic = "force-dynamic";

/**
 * 고정 현황.
 *
 * 주간 리셋의 예외를 모아 보여준다. 고정은 편성표의 칸마다 걸리므로, 걸어둔 뒤에는
 * 어디에 몇 개가 걸려 있는지 알 방법이 없다. **핀이 방치되는 것을 막는 유일한 수단이
 * 이 화면이다.**
 *
 * 이번 주 기준이다. 여기 있는 자리가 화요일 00시에 그대로 다음 주로 넘어간다.
 */
export default async function PinnedPage({ params }: PageProps<"/i/[slug]/pinned">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);

  const weekStart = getWeekStart();
  const week = toWeekParam(weekStart);
  const entries = await listPinned(instance.id, weekStart);

  // 슬롯 단위로 묶는다. 한 슬롯에 자리가 여럿 걸려 있는 것이 보통이다.
  const slots = new Map<
    string,
    {
      slotId: string;
      slotLabel: string;
      dayOfWeek: number;
      startTime: string;
      keepRoster: boolean;
      seats: { position: string; characterName: string | null }[];
    }
  >();

  for (const entry of entries) {
    const slot = slots.get(entry.slotId) ?? {
      slotId: entry.slotId,
      slotLabel: entry.slotLabel,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      keepRoster: false,
      seats: [],
    };

    if (entry.keepRoster) slot.keepRoster = true;
    else if (entry.position) {
      slot.seats.push({ position: entry.position, characterName: entry.characterName });
    }

    slots.set(entry.slotId, slot);
  }

  const list = [...slots.values()];
  const seatCount = list.reduce((sum, slot) => sum + slot.seats.length, 0);
  const keepCount = list.filter((slot) => slot.keepRoster).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">고정 현황</h1>
        <p className="mt-1 text-sm text-text-dim">
          화요일 0시에 인원이 비워질 때 <strong>남는 자리</strong>입니다. 걸어둔 것을
          잊으면 다음 주 편성이 그만큼 막히므로 여기서 한 번에 확인하고 풉니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-dim">
        <span>
          고정 자리 <strong className="text-text tabular">{seatCount}</strong>
        </span>
        <span>
          전원 고정 레이드 <strong className="text-text tabular">{keepCount}</strong>
        </span>
      </div>

      {list.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          고정한 자리가 없습니다. 다음 주에는 편성이 모두 비워집니다.
          <br />
          <span className="text-text-faint">
            편성표에서 칸의 압정을 누르면 그 자리만 다음 주로 넘어갑니다.
          </span>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((slot) => (
            <li key={slot.slotId} className="rounded border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2">
                <h2 className="font-semibold">{slot.slotLabel}</h2>
                <span className="slot-badge">{dayNameFull(slot.dayOfWeek)}</span>
                <span className="slot-badge tabular">{slot.startTime}</span>

                {slot.keepRoster && (
                  <span className="ml-auto">
                    <KeepRosterOffButton slug={slug} slotId={slot.slotId} />
                  </span>
                )}
              </div>

              {slot.keepRoster && (
                <p className="border-b border-border px-3 py-2 text-xs text-text-dim">
                  이 레이드는 <strong className="text-accent">전원 고정</strong>이라 자리와
                  상관없이 인원 전체가 다음 주로 넘어갑니다.
                </p>
              )}

              {slot.seats.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-faint">따로 고정한 자리는 없습니다.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {slot.seats.map((seat) => (
                    <li
                      key={seat.position}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm"
                    >
                      <span className="w-14 shrink-0 text-xs text-text-dim">
                        {positionLabel(seat.position)}
                      </span>
                      <span className="font-medium">{seat.characterName ?? "-"}</span>
                      <span className="ml-auto">
                        <UnpinButton
                          slug={slug}
                          week={week}
                          slotId={slot.slotId}
                          position={seat.position}
                          characterName={seat.characterName}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-text-faint">
        편성은{" "}
        <Link href={`/i/${slug}`} className="text-accent hover:underline">
          편성표
        </Link>
        에서 짭니다. 이 화면은 고정만 다룹니다.
      </p>
    </div>
  );
}

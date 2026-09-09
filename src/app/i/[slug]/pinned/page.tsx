import Link from "next/link";

import { listPinned } from "@/lib/board";
import { requireInstance } from "@/lib/instance";
import { positionLabel } from "@/lib/positions";
import { difficultyTone } from "@/lib/raids";
import { compareWeekDay, dayNameFull, isUndecided } from "@/lib/week";

import { KeepRosterOffButton, UnpinButton } from "./PinnedControls";

export const dynamic = "force-dynamic";

/**
 * 고정 현황.
 *
 * 주간 리셋의 예외를 모아 보여준다. 고정은 편성표의 칸마다 걸리므로, 걸어둔 뒤에는
 * 어디에 몇 개가 걸려 있는지 알 방법이 없다. **핀이 방치되는 것을 막는 유일한 수단이
 * 이 화면이다.**
 *
 * 진행 중인 편성 기준이다. 여기 있는 자리가 다음 초기화에서 그대로 넘어간다.
 * 주차는 요일마다 다를 수 있어 슬롯이 각자 들고 온다(PinnedEntry.week).
 */
export default async function PinnedPage({ params }: PageProps<"/i/[slug]/pinned">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);

  const entries = await listPinned(instance.id);

  // 슬롯 단위로 묶는다. 한 슬롯에 자리가 여럿 걸려 있는 것이 보통이다.
  const slots = new Map<
    string,
    {
      slotId: string;
      raidName: string;
      difficulty: string | null;
      dayOfWeek: number;
      startTime: string;
      keepRoster: boolean;
      week: string;
      seats: { position: string; characterName: string | null }[];
    }
  >();

  for (const entry of entries) {
    const slot = slots.get(entry.slotId) ?? {
      slotId: entry.slotId,
      raidName: entry.raidName,
      difficulty: entry.difficulty,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      keepRoster: false,
      week: entry.week,
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

  // 요일로 한 번 더 묶는다. 슬롯은 이미 요일·시각 순으로 와서 무리 안의 순서는 그대로다.
  const byDay = new Map<number, typeof list>();
  for (const slot of list) {
    const group = byDay.get(slot.dayOfWeek);
    if (group) group.push(slot);
    else byDay.set(slot.dayOfWeek, [slot]);
  }
  const days = [...byDay.keys()].sort(compareWeekDay);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">고정 현황</h1>
        <p className="mt-1 text-sm text-text-dim">
          인원이 비워질 때 <strong>남는 자리</strong>입니다. 걸어둔 것을
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
        /*
          요일로 가른다. 이 화면이 답하는 것은 "다음 주에 어느 칸이 막혀 있나"라
          읽는 단위가 요일이고, 카드마다 요일 뱃지만 달아 두면 같은 요일을 여러 번
          읽어가며 눈으로 묶어야 한다. 순서는 편성표 요일 탭과 같다(compareWeekDay).

          카드는 폭에 맞춰 옆으로 채운다. 한 줄에 하나씩 세우면 넓은 화면에서 카드가
          가로를 다 먹고 세로로만 쌓여 화면이 이유 없이 길어진다. 숙제 카드와 같은
          방식이라 좁은 화면에서는 그대로 한 줄이다.

          items-start를 두는 이유는 자리 수가 카드마다 달라서다. 늘리면 자리 하나짜리
          카드가 옆 카드 높이에 맞춰 아래가 텅 빈다. 숙제 카드와 달리 바닥에 세울
          합계가 없다.
        */
        <div className="space-y-5">
          {days.map((day) => (
            <section key={day} className="space-y-2">
              {/*
                제목 옆으로 실선을 끌어 요일 사이를 끊는다. 요일표 편집은 줄이 세로로
                쌓여 제목만으로 갈리지만, 여기는 카드가 격자로 서서 어느 카드까지가
                이 요일인지 제목만으로는 잡히지 않는다.
              */}
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {dayNameFull(day)}
                <span className="text-xs font-normal text-text-faint tabular">
                  {byDay.get(day)!.length}
                </span>
                <span className="h-px flex-1 bg-border" />
              </h2>
              <ul className="grid items-start gap-3 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
                {byDay.get(day)!.map((slot) => (
                  <li key={slot.slotId} className="rounded border border-border bg-surface">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2">
                      {/*
                        난이도는 편성표·요일표와 같은 색 뱃지다. 세 화면이 같은 레이드를
                        다르게 그리면 어느 줄이 어느 슬롯인지 눈으로 맞춰봐야 한다.
                        이름과 묶는 이유도 같다 — 접힐 때 난이도만 떨어져 나가지 않게.
                      */}
                      <span className="flex items-center gap-x-2">
                        <h3 className="font-semibold">{slot.raidName}</h3>
                        {slot.difficulty && (
                          <span className="slot-badge" data-diff={difficultyTone(slot.difficulty)}>
                            {slot.difficulty}
                          </span>
                        )}
                      </span>
                      {/*
                        요일 뱃지는 달지 않는다. 바로 위 제목이 그 요일이라 카드마다 같은
                        말을 한 번 더 적는 꼴이 된다. 미정 칸에는 시각도 없다 — 채워 넣은
                        값을 보여주면 약속처럼 읽힌다.
                      */}
                      {!isUndecided(slot.dayOfWeek) && (
                        <span className="slot-badge tabular">{slot.startTime}</span>
                      )}

                      {slot.keepRoster && (
                        <span className="ml-auto">
                          <KeepRosterOffButton slug={slug} week={slot.week} slotId={slot.slotId} />
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
                                week={slot.week}
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
            </section>
          ))}
        </div>
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

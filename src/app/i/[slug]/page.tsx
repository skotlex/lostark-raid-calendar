import { cookies } from "next/headers";
import Link from "next/link";

import { getBoard } from "@/lib/board";
import { prisma } from "@/lib/prisma";
import { requireInstance } from "@/lib/instance";
import { findMyMember } from "@/lib/members";
import { requireSession } from "@/lib/session";
import {
  TUESDAY,
  UNDECIDED,
  addWeeks,
  compareWeekDay,
  dayName,
  dayNameFull,
  formatWeekLabel,
  getPlanningWeekStart,
  isEditableWeek,
  isTuesdayCarryWindow,
  isUndecided,
  parseDayParam,
  parseWeekParam,
  toWeekParam,
} from "@/lib/week";

import { AutoSync } from "./AutoSync";
import { CompactSlot } from "./CompactSlot";
import { KnownNamesProvider } from "./NameInput";
import { PresenceBar, PresenceProvider } from "./Presence";
import { ViewToggle } from "./ViewToggle";
import { BOARD_VIEW_COOKIE, toBoardView } from "./view";
import { RememberDay } from "./lastDay";
import { SlotCard } from "./SlotCard";

export const dynamic = "force-dynamic";

// 이 페이지의 서버 액션에 적용된다. 자동 갱신이 캐릭터 수십 개를 순차로 조회하므로
// 기본 제한(10초)으로는 중간에 끊긴다.
export const maxDuration = 60;

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
  const asked = parseDayParam(typeof query.day === "string" ? query.day : undefined);
  const week = toWeekParam(weekStart);

  /*
   * 지금 채우는 주차인가. 여기서 앞으로는 더 갈 수 없다 — 다음 주차는 아직 열리지
   * 않았고, 열어봐야 서버가 쓰기를 거부하는 빈 화면이다.
   */
  const planningWeek = getPlanningWeekStart();
  const isPlanning = weekStart.getTime() === planningWeek.getTime();

  // 보는 사람마다 다르다. 쿠키라 브라우저 안에서만 산다(view.ts).
  const view = toBoardView((await cookies()).get(BOARD_VIEW_COOKIE)?.value);

  const board = await getBoard(instance.id, weekStart, session.label);

  const countByDay = new Map<number, number>();
  for (const slot of board) {
    countByDay.set(slot.dayOfWeek, (countByDay.get(slot.dayOfWeek) ?? 0) + 1);
  }
  // 레이드가 있는 요일만 탭으로 낸다. 일곱 개를 늘 세워두면 빈 요일을 짚어 들어갔다가
  // 되돌아 나오게 된다. 수요일 시작 순서는 주차 경계(수 06시)와 같다.
  //
  // 미정은 요일이 아니라 요일 밖의 칸이라 이 줄에 끼우지 않는다. 주간 일정을 훑는
  // 자리에 섞이면 "화요일 다음"으로 읽혀 언제 가는 것인지 헷갈린다. 반대쪽 끝,
  // 보기 토글 왼쪽에 따로 세운다.
  const days = [...countByDay.keys()].filter((d) => !isUndecided(d)).sort(compareWeekDay);
  const hasUndecided = countByDay.has(UNDECIDED);

  // 물어본 요일이 비어 있으면 레이드가 있는 첫 요일로 데려간다. 오늘이 빈 요일이라
  // 처음부터 빈 화면이 열리는 일이 없게 한다. 미정에만 레이드가 있으면 미정으로 간다.
  const day = countByDay.has(asked)
    ? asked
    : (days[0] ?? (hasUndecided ? UNDECIDED : asked));
  const slots = board.filter((slot) => slot.dayOfWeek === day);

  /*
   * 잠금은 **주차가 아니라 (주차, 요일) 짝**으로 갈린다(week.ts).
   *
   * 화 00시가 지나면 화면은 다음 주차를 펴는데 그날 저녁 화요일 공대는 아직 지난
   * 주차에 살아 있다. 그래서 지난 주 화면에서도 화요일 탭만 열려 있고, 나머지 요일은
   * 굳어 있다. 지금 펴 놓은 요일이 그 둘 중 어느 쪽인지가 이 값이다.
   */
  const editable = isEditableWeek(weekStart, day);

  /*
   * 지난 주 화면인데 화요일만 아직 열려 있는 30시간 창.
   *
   * 화요일 슬롯이 있는 주에만 말이 된다. 요일표에 화요일 레이드가 없으면 열려 있어도
   * 가리킬 것이 없어 안내를 세우지 않는다.
   */
  const tuesdayOpen =
    !isPlanning && countByDay.has(TUESDAY) && isEditableWeek(weekStart, TUESDAY);

  /*
   * 지금 펴 놓은 것이 **다음 주 화요일**인가.
   *
   * 창 안에서는 이 탭이 엿새 뒤 공대라 비어 있는데, 화요일에 편성표를 열면 오늘
   * 요일이 먼저 펴지므로(parseDayParam) 오늘 밤 공대가 사라진 것처럼 보인다.
   * 그쪽이 어디 있는지 한 줄로 알린다.
   */
  const showsNextTuesday = isPlanning && day === TUESDAY && isTuesdayCarryWindow();

  // 칸 입력의 자동완성 목록. 이미 등록된 캐릭터는 API를 다시 부르지 않는다.
  // 컨텍스트로 한 번만 실어 보낸다. 칸마다 넘기면 같은 목록이 칸 수만큼 직렬화된다.
  const myMember = await findMyMember(instance.id, session.discordUserId);
  const known = await prisma.character.findMany({
    where: { instanceId: instance.id },
    select: { name: true, memberId: true, className: true, itemLevel: true },
    orderBy: { itemLevel: "desc" },
  });
  // 아무것도 안 쳤을 때는 내 캐릭터만 보여준다(NameInput). 그래서 소속을 함께 싣는다.
  // Prisma의 Decimal은 클라이언트 컴포넌트로 넘길 수 없어 숫자로 바꾼다.
  const knownCharacters = known.map((c) => ({
    name: c.name,
    mine: Boolean(myMember && c.memberId === myMember.id),
    className: c.className,
    itemLevel: c.itemLevel === null ? null : Number(c.itemLevel),
  }));

  // 편성에 들어와 있는 캐릭터 중 스펙이 오래된 것. 있으면 화면이 열린 뒤 알아서 갱신된다.
  const stale = new Set<string>();
  for (const slot of board) {
    for (const party of slot.parties) {
      for (const cell of party.cells) {
        if (cell.character?.stale && !cell.character.syncError) stale.add(cell.character.id);
      }
    }
  }

  function href(next: { day?: number; week?: string }) {
    const d = next.day ?? day;
    const w = next.week ?? week;
    return `/i/${slug}?day=${d}&week=${w}`;
  }

  const content = (
    <div className="space-y-4">
      {/* 다른 화면에 갔다 돌아왔을 때 보던 요일로 열리게 한다. */}
      <RememberDay day={day} />
      <AutoSync slug={slug} staleCount={stale.size} />

      {/*
        밑줄이 놓일 레일. 이게 없으면 켜진 탭의 밑줄만 허공에 떠 보인다.

        본문 스크롤 영역의 맨 위(top-0)에 붙여 스크롤해도 남는다. 그 영역이 이미
        머리줄 밑에서 시작하므로 따로 내려 잡을 것이 없다(MainScroll). 요일과 주차를
        보면서 아래쪽 공대를 읽는 화면이라 이 줄이 올라가 버리면 지금 무엇을 보고
        있는지 모른 채 스크롤하게 된다. 밑을 지나가는 카드가 비치지 않게 배경을 깐다.
      */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-b border-border bg-bg pt-2">
        {/*
          요일 줄만 왼쪽에 남기고(mr-auto) 나머지는 오른쪽으로 몬다. 줄이 넘칠 때가
          이유다. ml-auto로 밀면 남는 자리가 있는 줄에서만 먹어서, 미정과 보기 토글이
          아래 줄로 내려가는 순간 왼쪽 끝에 붙어 버렸다. justify-end는 접힌 줄에도
          그대로 걸린다.
        */}
        <nav className="mr-auto flex flex-wrap">
          {days.map((d) => (
            <DayTab
              key={d}
              href={href({ day: d })}
              day={d}
              active={d === day}
              count={countByDay.get(d) ?? 0}
            />
          ))}
        </nav>

        {/*
          미정 탭. 요일 줄이 아니라 보기 토글 바로 왼쪽이다.
          nav 밖에 두되 레일의 직계 자식으로 남긴다. 오른쪽 묶음(pb-1.5) 안으로
          넣으면 밑줄이 레일에서 떠 다른 탭과 어긋난다.
        */}
        {hasUndecided && (
          <DayTab
            href={href({ day: UNDECIDED })}
            day={UNDECIDED}
            active={day === UNDECIDED}
            count={countByDay.get(UNDECIDED) ?? 0}
          />
        )}

        {/*
          같이 보고 있는 사람. 요일 줄 반대쪽, 보기 토글 왼쪽이다. 아무도 없으면
          아무것도 서지 않는다(Presence.tsx).
        */}
        <PresenceBar />

        <div className="flex items-center gap-2 pb-1.5 text-sm">
          <ViewToggle initial={view} />

          <Link
            href={href({ week: toWeekParam(addWeeks(weekStart, -1)) })}
            className="week-arrow"
          >
            ‹
          </Link>
          <span className="px-1 text-xs text-text-dim tabular">
            {formatWeekLabel(weekStart)}
          </span>
          {/*
            지금 채우는 주차가 마지막이다. 그 앞은 아직 열리지 않은 주차라 칸이 비어
            있고 서버가 쓰기를 거부한다 — 빈 화면에 이름을 쳐 넣다가 거절당하는 것보다
            들어가지 못하게 하는 편이 낫다. 자리는 남겨 둔다. 화살표가 사라지면 그
            옆의 주차 라벨이 좌우로 흔들린다.
          */}
          {isPlanning ? (
            <span
              className="week-arrow"
              data-disabled
              aria-disabled="true"
              title="다음 주 편성은 아직 열리지 않았습니다"
            >
              ›
            </span>
          ) : (
            <Link
              href={href({ week: toWeekParam(addWeeks(weekStart, 1)) })}
              className="week-arrow"
            >
              ›
            </Link>
          )}
          {!isPlanning && (
            <Link
              href={href({ week: toWeekParam(planningWeek) })}
              className="ml-1 rounded bg-accent/15 px-2 py-1 text-xs text-accent"
            >
              이번 주로
            </Link>
          )}
        </div>
      </div>

      {/*
        지난 주 화면. **한 주차가 통째로 잠기지 않는다**(week.ts).

        화 00시부터 수 06시까지는 이 화면의 화요일만 아직 오늘 밤 공대라 열려 있다.
        문구를 하나로 두면 열려 있는 칸을 앞에 두고 "고칠 수 없습니다"라고 말하게 되고,
        반대로 잠긴 요일에 서 있을 때는 화요일이 열려 있다는 것을 알 길이 없다.
      */}
      {!isPlanning && (
        <p className="rounded border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
          {editable ? (
            <>
              지난 주 편성입니다. <strong className="text-text">화요일 일정만</strong> 아직
              고칠 수 있습니다.
            </>
          ) : (
            <>
              지난 주 편성입니다. 기록으로만 보여주며 고칠 수 없습니다.
              {tuesdayOpen && (
                <>
                  {" "}
                  <Link href={href({ day: TUESDAY })} className="text-accent hover:underline">
                    화요일 일정은 아직 고칠 수 있습니다
                  </Link>
                </>
              )}
            </>
          )}
        </p>
      )}

      {/*
        다음 주 화요일 칸. 오늘 밤 공대는 지난 주 화면에 있다.

        화요일에 편성표를 열면 오늘 요일이 먼저 펴지는데, 이 시각의 화요일 탭은 이미
        엿새 뒤 공대라 비어 있다. 잠그지는 않는다 — 다음 주 화요일을 미리 잡아 두는
        것이 이 칸의 쓰임이다.
      */}
      {showsNextTuesday && (
        <p className="rounded border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
          <strong className="text-text">다음 주</strong> 화요일 칸입니다. 오늘 밤 화요일
          편성은{" "}
          <Link
            href={href({ week: toWeekParam(addWeeks(weekStart, -1)), day: TUESDAY })}
            className="text-accent hover:underline"
          >
            지난 주 화면
          </Link>
          에 있습니다.
        </p>
      )}

      {slots.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          아직 등록된 레이드가 없습니다.
          <br />
          <Link href={`/i/${slug}/slots`} className="text-accent hover:underline">
            요일표 편집에서 레이드를 추가해 주세요
          </Link>
        </div>
      ) : (
        <KnownNamesProvider characters={knownCharacters}>
          <div className="space-y-4">
            {slots.map((slot) =>
              // 4인은 카드로도 한 줄에 들어간다. 초상까지 보이는 편이 낫다.
              view === "compact" && slot.partySize === 8 ? (
                <CompactSlot
                  key={slot.id}
                  slug={slug}
                  week={week}
                  slot={slot}
                  editable={editable}
                />
              ) : (
                <SlotCard
                  key={slot.id}
                  slug={slug}
                  week={week}
                  slot={slot}
                  editable={editable}
                />
              ),
            )}
          </div>
        </KnownNamesProvider>
      )}
    </div>
  );

  /*
   * 굳은 칸에는 실시간 표시를 걸지 않는다.
   *
   * 고칠 수 없는 화면이라 바뀔 것도, 남이 만지고 있을 칸도 없다. 여기까지 하트비트를
   * 돌리면 아무도 읽지 않을 발자국 때문에 몇 초마다 요청이 하나씩 더 나간다.
   *
   * **주차가 아니라 지금 펴 놓은 요일로 잰다.** 30시간 창 안의 지난 주 화요일 탭은
   * 지난 주차인데도 열려 있어 둘이 같이 짜는 자리다. 주차로 재면 그 탭에서만 서로가
   * 안 보인다.
   */
  if (!editable) return content;

  return (
    <PresenceProvider slug={slug} week={week} day={day}>
      {content}
    </PresenceProvider>
  );
}

/**
 * 요일 탭 하나.
 *
 * 요일 줄과 미정이 같은 모양이라야 둘이 같은 종류의 칸으로 읽힌다. 자리만 다르다.
 */
function DayTab({
  href,
  day,
  active,
  count,
}: {
  href: string;
  day: number;
  active: boolean;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="day-tab"
      data-active={active}
      aria-current={active ? "page" : undefined}
    >
      {/*
        좁아지면 `수요일`이 `수`가 된다. 요일이 일곱이면 뱃지까지 붙어 한 줄에 못 들어가고,
        접힌 줄이 주차 이동과 보기 토글을 아래로 밀어 화면 위쪽을 통째로 먹는다.
        미정은 두 이름이 같아 그대로다(week.ts).

        지우지 않고 감추기만 한다. 화면 낭독기에는 늘 전체 이름이 읽힌다.
      */}
      <span className="day-tab-full">{dayNameFull(day)}</span>
      <span className="day-tab-short" aria-hidden>
        {dayName(day)}
      </span>
      {count > 0 && (
        <span className="day-badge" title={`레이드 ${count}개`}>
          {count}
        </span>
      )}
    </Link>
  );
}

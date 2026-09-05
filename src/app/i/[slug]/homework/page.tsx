import Link from "next/link";

import { getHomework } from "@/lib/homework";
import { requireInstance } from "@/lib/instance";
import { findMyMember } from "@/lib/members";
import { requireSession } from "@/lib/session";
import { classColor } from "@/lib/classColors";
import { classEmblem } from "@/lib/classEmblems";
import { dayName } from "@/lib/week";

export const dynamic = "force-dynamic";

const gold = new Intl.NumberFormat("ko-KR");

/**
 * 숙제 관리.
 *
 * **편성표에 넣은 것이 곧 숙제다.** 여기서 따로 체크하지 않는다. 요일과 시각이 이미
 * 정해진 슬롯이므로 그 시각이 지나면 다녀온 것으로 본다(homework.ts).
 *
 * 보여주는 것은 **내 캐릭터뿐**이다. 길드 전체를 늘어놓으면 무엇이 내 일인지 찾는 화면이
 * 되고, 골드 합계도 남의 것과 섞여 의미가 없어진다.
 */
export default async function HomeworkPage({ params }: PageProps<"/i/[slug]/homework">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);
  const session = await requireSession(`/i/${slug}/homework`);
  const member = await findMyMember(instance.id, session.discordUserId);
  const homework = await getHomework(instance.id, member?.id ?? null);

  if (homework.characters.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          이번 주에 편성된 내 캐릭터가 없습니다.
          <br />
          <Link href={`/i/${slug}`} className="text-accent hover:underline">
            편성표에서 칸에 캐릭터를 넣어 주세요
          </Link>
          <br />
          <span className="text-xs text-text-faint">
            {member
              ? "편성표에 넣은 내 캐릭터가 여기에 숙제로 쌓입니다."
              : "캐릭터 관리에서 내 원정대를 먼저 불러와야 어느 것이 내 캐릭터인지 알 수 있습니다."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      {/*
        이번 주 진행률.

        왼쪽 숫자는 **남은 것**이다. 이미 받은 골드보다 앞으로 받을 골드가 계획을 세울 때
        필요한 값이고, 얼마나 지나왔는지는 막대가 따로 말한다.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Progress
          value={`${gold.format(homework.remainingGold)}`}
          total={`/ ${gold.format(homework.totalGold)}`}
          done={homework.totalGold - homework.remainingGold}
          all={homework.totalGold}
          tone="var(--accent)"
        />
        <Progress
          value={`남은 숙제 ${homework.remainingCount}`}
          total={`/ ${homework.totalCount}`}
          done={homework.totalCount - homework.remainingCount}
          all={homework.totalCount}
          tone="var(--support)"
        />
      </div>

      {/* 레이드별 현황 — 무엇이 몇 개 남았는지부터 본다. */}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {homework.raids.map((raid) => (
          <li key={raid.raidName} className="rounded border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center gap-x-2">
              <h2 className={`font-semibold ${raid.remaining > 0 ? "text-accent" : ""}`}>
                {raid.raidName}
              </h2>
              <span
                className={`ml-auto rounded px-1.5 py-0.5 text-[11px] tabular ${
                  raid.remaining > 0
                    ? "bg-accent/15 text-accent"
                    : "text-text-faint"
                }`}
              >
                남은 숙제 {raid.remaining}개
              </span>
            </div>

            {/* 이 레이드가 이번 주에 주는 골드. 다녀온 것까지 합친 값이다. */}
            <div className="mt-1 flex items-baseline gap-x-2 text-sm">
              <span className="text-xs text-text-faint">골드</span>
              <span
                className={`ml-auto tabular ${
                  raid.remaining > 0 ? "text-accent" : "text-text-dim"
                }`}
              >
                {raid.totalGold > 0 ? gold.format(raid.totalGold) : "-"}
              </span>
            </div>

            {/*
              이름을 뱃지로 두른다. 글자만 늘어놓으면 여럿일 때 어디까지가 한 이름인지
              눈으로 끊어야 한다. 다녀온 사람은 흐리게 가라앉힌다.
            */}
            <div className="mt-2 flex flex-wrap gap-1 border-t border-dashed border-border pt-2">
              {raid.characters.map((character) => (
                <span
                  key={character.name}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    character.done
                      ? "bg-surface-2/60 text-text-faint line-through"
                      : "bg-surface-2 text-text-dim"
                  }`}
                >
                  {character.name}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {/* 캐릭터별 숙제 — 위에서 아래로 읽으면 주간 일정이 된다. */}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {homework.characters.map((character) => (
          <li
            key={character.id}
            className="overflow-hidden rounded border border-border bg-surface"
          >
            <div
              className="flex items-center gap-2 px-3 py-2 text-white"
              style={{ backgroundColor: classColor(character.className) }}
            >
              {/*
                직업 문장(classEmblems.ts). next/image를 거치지 않는다. SVG라 최적화할
                것이 없고, 거치려면 SVG 허용 설정을 켜야 하는데 그건 다른 위험을 연다.
                없는 직업이면 자리만 비운다.
              */}
              {classEmblem(character.className) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={classEmblem(character.className)!}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  className="class-emblem size-7 shrink-0"
                />
              )}

              <div className="min-w-0">
                <div className="truncate font-semibold">{character.name}</div>
                <div className="text-xs tabular opacity-90">
                  {character.itemLevel?.toFixed(2) ?? "-"}
                  {character.combatPower !== null && ` · ${character.combatPower.toFixed(2)}`}
                </div>
              </div>
            </div>

            <ul className="divide-y divide-border">
              {character.entries.map((entry) => (
                <li
                  key={entry.slotId}
                  className={`flex flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-sm ${
                    entry.done ? "text-text-faint" : ""
                  }`}
                >
                  <span className={entry.done ? "line-through" : "font-medium"}>
                    {entry.label}
                  </span>
                  <span className="text-xs text-text-faint tabular">
                    {dayName(entry.dayOfWeek)} {entry.startTime}
                  </span>
                  <span className="ml-auto text-xs tabular">
                    {entry.clearGold === null ? "-" : `${gold.format(entry.clearGold)} G`}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-baseline gap-x-2 border-t border-border px-3 py-2 text-xs">
              <span className="text-text-dim">
                남은 숙제 <span className="tabular">{character.remaining}</span>개
              </span>
              <span className="ml-auto tabular text-text-dim">
                {gold.format(character.clearGold)} G
              </span>
              {character.moreCost > 0 && (
                <span className="tabular text-danger">
                  더보기 -{gold.format(character.moreCost)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 진행 막대.
 *
 * 숫자만으로는 "많이 남았다"가 잘 안 읽힌다. 막대가 있으면 눈으로 한 번에 가늠된다.
 * 퍼센트는 오른쪽 끝에 붙여 숫자와 막대를 잇는다.
 */
function Progress({
  value,
  total,
  done,
  all,
  tone,
}: {
  value: string;
  total: string;
  done: number;
  all: number;
  /** 막대 색. 골드와 숙제를 다른 색으로 둔다 */
  tone: string;
}) {
  const percent = all > 0 ? Math.round((done / all) * 100) : 0;

  return (
    <div className="rounded border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold tabular" style={{ color: tone }}>
          {value}
        </span>
        <span className="text-xs text-text-faint tabular">{total}</span>
        <span className="ml-auto text-xs tabular text-text-dim">{percent}%</span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%`, backgroundColor: tone }}
        />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-xl font-bold">숙제 관리</h1>
      <p className="mt-1 text-sm text-text-dim">
        편성표에 넣은 <strong>내 캐릭터</strong>의 이번 주 숙제입니다. 따로 체크하지 않아도
        레이드 시각이 지나면 다녀온 것으로 봅니다.
      </p>
    </div>
  );
}

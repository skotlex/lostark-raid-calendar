import Link from "next/link";

import { getHomework } from "@/lib/homework";
import { requireInstance } from "@/lib/instance";
import { findMyMember } from "@/lib/members";
import { requireSession } from "@/lib/session";
import { classColor } from "@/lib/classColors";
import { classEmblem } from "@/lib/classEmblems";
import { CombatPowerIcon, GoldIcon, ItemLevelIcon } from "../icons";
import { EntryList } from "./EntryList";

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
      <section className="space-y-2">
        <SectionTitle title="이번 주 진행률" hint="왼쪽 숫자가 아직 남은 몫입니다" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Progress
            label="남은 골드"
            // 단위는 분모에만 붙인다. `179,000 / 250,000 G`면 한 번만 읽어도 둘 다
            // 골드인 줄 알고, 앞뒤로 붙이면 같은 글자가 두 번 나와 숫자가 덜 읽힌다.
            value={gold.format(homework.remainingGold)}
            total={`/ ${gold.format(homework.totalGold)} G`}
            /*
              더보기 값을 뺀 합계. 캐릭터 카드의 "더보기 함"과 같은 계산이다.

              막대와 큰 숫자는 더보기를 안 켠 기준으로 둔다. 켤지 말지는 그때 정하는
              것이고 자리에 따라 달라져 편성표가 알 수 없다(CLAUDE.md 2-3).
              그래도 다 켜면 얼마가 남는지는 이 화면에서 바로 보여야 한다.
            */
            note={
              homework.totalMoreCost > 0
                ? `(더보기 제외: ${gold.format(
                    homework.totalGold - homework.totalMoreCost,
                  )} G)`
                : undefined
            }
            done={homework.totalGold - homework.remainingGold}
            all={homework.totalGold}
            tone="var(--accent)"
          />
          <Progress
            label="남은 숙제"
            value={`${homework.remainingCount}`}
            total={`/ ${homework.totalCount}`}
            done={homework.totalCount - homework.remainingCount}
            all={homework.totalCount}
            tone="var(--support)"
          />
        </div>
      </section>

      {/* 레이드별 현황 — 무엇이 몇 개 남았는지부터 본다. */}
      <section className="space-y-2">
        <SectionTitle
          title="레이드별 현황"
          hint="레이드마다 누가 남았는지 · 다녀온 사람은 흐리게"
        />

        {/*
          칸 수를 화면 폭으로 정하지 않고 카드가 필요한 폭으로 정한다.
          두 칸으로 갈리는 구간에서는 카드 하나가 화면의 절반을 차지해 글자 몇 줄만
          담긴 상자가 휑하게 넓어졌다.
        */}
        <ul className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
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

            {/*
              이 레이드가 이번 주에 주는 골드. 다녀온 것까지 합친 값이다.

              오른쪽 여백은 위 뱃지와 맞춘 값이다. 뱃지는 안쪽 여백이 있어 글자가 카드
              끝에서 조금 들어와 있는데, 이 줄에 여백이 없으면 두 숫자의 오른쪽 끝이
              어긋나 보인다.
            */}
            <div className="mt-1 flex items-baseline gap-x-2 pr-1.5 text-sm">
              <span className="text-xs text-text-faint">골드</span>
              <span
                className={`ml-auto tabular ${
                  raid.remaining > 0 ? "text-accent" : "text-text-dim"
                }`}
              >
                {raid.totalGold > 0 ? `${gold.format(raid.totalGold)} G` : "-"}
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
      </section>

      {/*
        캐릭터별 숙제.

        **보상이 큰 순으로 세운다.** 앞의 셋만 골드를 받으므로(goldEarners.ts) 이 순서가
        곧 "어느 레이드에서 골드를 받을 것인가"다. 요일 순으로 두면 늦은 요일에 잡힌
        큰 레이드가 이유 없이 잘려 나간다. 요일은 줄마다 뱃지로 그대로 보인다.
      */}
      <section className="space-y-2">
        <SectionTitle
          title="캐릭터별 숙제"
          hint="줄을 끌어 옮기면 골드를 받을 세 개가 바뀝니다"
        />

        {/*
          카드는 세로 flex다. 레이드 줄 수가 캐릭터마다 달라도 아래 합계가 카드 바닥에
          나란히 서게 하려는 것이다(EntryList의 mt-auto). 칸 높이는 grid가 이미 줄마다
          맞춰 주므로, 남는 자리를 어디에 둘지만 정하면 된다.
        */}
        <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
        {homework.characters.map((character) => (
          <li
            key={character.id}
            className="flex flex-col overflow-hidden rounded border border-border bg-surface"
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

              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{character.name}</div>
                <div className="flex items-center gap-x-2 text-xs tabular opacity-90">
                  <span className="flex items-center gap-1" title="아이템 레벨">
                    <ItemLevelIcon />
                    {character.itemLevel?.toFixed(2) ?? "-"}
                  </span>
                  {character.combatPower !== null && (
                    <span className="flex items-center gap-1" title="전투력">
                      <CombatPowerIcon />
                      {character.combatPower.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/*
                골드를 받는 캐릭터인가. 원정대 하나에서 여섯뿐이다(goldEarners.ts).

                아래 골드 줄이 0으로 찍히는 이유가 여기 있어야 한다. 표시가 없으면
                "왜 이 캐릭터만 0원이지"를 설명할 자리가 화면에 없다.
              */}
              <span
                className={`shrink-0 ${character.goldEarner ? "" : "opacity-55"}`}
                title={
                  character.goldEarner
                    ? "주간 골드를 받는 캐릭터입니다"
                    : "골드를 받지 않는 캐릭터입니다. 대신 더보기가 무료입니다"
                }
              >
                <GoldIcon earning={character.goldEarner} />
              </span>
            </div>

            <EntryList slug={slug} characterId={character.id} entries={character.entries} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** 덩어리마다 무엇을 보는 화면인지 한 줄로 알린다. */
function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-xs text-text-faint">{hint}</span>
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
  label,
  value,
  total,
  note,
  done,
  all,
  tone,
}: {
  label: string;
  value: string;
  total: string;
  /**
   * 합계 옆에 덧붙이는 값. 지금은 더보기 값을 뺀 골드가 들어간다.
   *
   * 막대와 큰 숫자는 계획을 세울 때 보는 값이라 하나여야 한다. 둘째 값을 같은 크기로
   * 세우면 어느 쪽이 기준인지 매번 다시 정해야 한다. 흐리게, 괄호로 뒤에 붙인다.
   */
  note?: string;
  done: number;
  all: number;
  /** 막대 색. 골드와 숙제를 다른 색으로 둔다 */
  tone: string;
}) {
  const percent = all > 0 ? Math.round((done / all) * 100) : 0;

  return (
    <div className="rounded border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs text-text-dim">{label}</span>
        <span className="font-semibold tabular" style={{ color: tone }}>
          {value}
        </span>
        <span className="text-xs text-text-faint tabular">{total}</span>
        {note && <span className="text-xs text-text-faint tabular">{note}</span>}
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
        레이드 시각이 지나면 다녀온 것으로 봅니다. 시각이 없는 <strong>미정</strong>만
        보상 수령을 눌러 주세요.
      </p>
    </div>
  );
}

import { listCharacters } from "@/lib/characters";
import { requireInstance } from "@/lib/instance";
import { findMyMember, listMyRosters } from "@/lib/members";
import { requireSession } from "@/lib/session";

import { CharacterCard } from "./CharacterCard";
import { DeleteGroupButton } from "./DeleteGroupButton";
import { type GoldRoster, GoldPanel } from "./GoldPanel";
import { RegisterPanel } from "./RegisterPanel";
import { SyncAllButton } from "./SyncAllButton";

export const dynamic = "force-dynamic";

// 이 페이지의 서버 액션에 적용된다. 자동 갱신이 캐릭터 수십 개를 순차로 조회하므로
// 기본 제한(10초)으로는 중간에 끊긴다.
export const maxDuration = 60;

export default async function CharactersPage({ params }: PageProps<"/i/[slug]/characters">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);
  const session = await requireSession(`/i/${slug}/characters`);
  const characters = await listCharacters(instance.id);
  const myMember = await findMyMember(instance.id, session.discordUserId);

  // 사람 단위로 묶어 보여준다. 부캐가 흩어져 있으면 누가 누군지 알 수 없다.
  const grouped = new Map<string, typeof characters>();
  for (const character of characters) {
    const key = character.memberLabel ?? "";
    const list = grouped.get(key);
    if (list) list.push(character);
    else grouped.set(key, [character]);
  }
  // 소속 없는 캐릭터는 맨 아래로 내린다.
  const groups = [...grouped.entries()].sort((a, b) => {
    if (a[0] === "") return 1;
    if (b[0] === "") return -1;
    return a[0].localeCompare(b[0], "ko");
  });

/*
   * 이 화면에서는 자동 갱신을 돌리지 않는다.
   *
   * 여기는 등록·삭제를 몰아서 하는 자리다. 그 사이에 캐릭터 수십 개를 조회하면 로아 큐가
   * 길어지고(분당 한도 때문에 최대 1분까지 잠든다), 바로 뒤에 누른 등록·삭제가 그만큼
   * 늦게 끝난다. 화면이 멎은 것처럼 보이는 원인이 된다.
   *
   * 갱신이 필요하면 이 화면에는 `전체 갱신`이 있고, 편성표를 열면 어차피 자동으로 돈다.
   */

  const supports = characters.filter((c) => c.role === "SUPPORT").length;
  const failed = characters.filter((c) => c.syncError).length;

  /*
   * 골드 지정은 **내 캐릭터만** 다룬다.
   *
   * 남의 원정대에서 누가 골드를 받는지는 그 사람이 정할 일이고, 숙제 화면도 자기 것만
   * 보여준다. 여기서 길드 전체를 늘어놓으면 남의 원정대를 건드리는 화면이 된다.
   *
   * 원정대가 안 붙은 내 캐릭터는 "원정대 미지정" 묶음으로 맨 뒤에 붙인다. 편성 칸으로
   * 만들어져 아직 불러오기를 거치지 않은 것들이라, 계정을 하나 더 가진 것처럼 보이지
   * 않게 이름 있는 원정대와 순서를 나눈다.
   */
  const rosterList = myMember ? await listMyRosters(instance.id, myMember.id) : [];
  const mine = myMember ? characters.filter((c) => c.memberId === myMember.id) : [];

  const goldRosters: GoldRoster[] = rosterList
    .map((roster) => ({
      id: roster.id,
      label: roster.label,
      characters: mine.filter((c) => c.rosterId === roster.id),
    }))
    .filter((roster) => roster.characters.length > 0);

  const unassigned = mine.filter((c) => c.rosterId === null);
  if (unassigned.length > 0) {
    goldRosters.push({ id: "", label: "원정대 미지정", characters: unassigned });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">캐릭터</h1>
        <p className="mt-1 text-sm text-text-dim">
          정리용 화면입니다. 편성은 <strong>편성표의 칸에 닉네임을 바로 입력</strong>하면 되고,
          여기서는 잘못 들어간 캐릭터 삭제, 딜/서폿 교정, 스펙 갱신, 부캐 묶기를 합니다.
        </p>
      </div>

      <RegisterPanel slug={slug} mine={myMember?.characterCount ?? 0} />

      {goldRosters.length > 0 && <GoldPanel slug={slug} rosters={goldRosters} />}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-dim">
        <span>
          전체 <strong className="text-text tabular">{characters.length}</strong>
        </span>
        <span>
          딜러 <strong className="text-dps tabular">{characters.length - supports}</strong>
        </span>
        <span>
          서폿 <strong className="text-support tabular">{supports}</strong>
        </span>
        {failed > 0 && <span className="text-danger">조회 실패 {failed}</span>}
        <div className="ml-auto">
          <SyncAllButton slug={slug} count={characters.length} />
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          아직 등록된 캐릭터가 없습니다.
          <br />
          <span className="text-text-faint">
            편성표 칸에 닉네임을 넣으면 자동으로 등록됩니다. 여기서 미리 넣어둘 수도 있습니다.
          </span>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, list]) => (
            <section key={label || "__none__"} className="space-y-2">
              <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span className={label ? "text-text" : "text-text-faint"}>
                  {label || "소속 미지정"}
                </span>
                <span className="text-xs text-text-faint tabular">{list.length}</span>
                {/* 원정대를 골라 등록하면 부캐가 한 번에 여럿 들어온다. 무를 때도 한 번에. */}
                <DeleteGroupButton slug={slug} label={label} count={list.length} />
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((character) => (
                  <CharacterCard key={character.id} slug={slug} character={character} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

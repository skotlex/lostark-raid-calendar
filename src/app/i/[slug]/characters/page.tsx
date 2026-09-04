import { listCharacters } from "@/lib/characters";
import { requireInstance } from "@/lib/instance";
import { requireSession } from "@/lib/session";

import { CharacterCard } from "./CharacterCard";
import { RegisterPanel } from "./RegisterPanel";
import { SyncAllButton } from "./SyncAllButton";

export const dynamic = "force-dynamic";

export default async function CharactersPage({ params }: PageProps<"/i/[slug]/characters">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);
  const session = await requireSession(`/i/${slug}/characters`);
  const characters = await listCharacters(instance.id);

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

  const supports = characters.filter((c) => c.role === "SUPPORT").length;
  const failed = characters.filter((c) => c.syncError).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">캐릭터</h1>
        <p className="mt-1 text-sm text-text-dim">
          정리용 화면입니다. 편성은 <strong>편성표의 칸에 닉네임을 바로 입력</strong>하면 되고,
          여기서는 잘못 들어간 캐릭터 삭제, 딜/서폿 교정, 스펙 갱신, 부캐 묶기를 합니다.
        </p>
      </div>

      <RegisterPanel slug={slug} viewerLabel={session.label} />

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
          아직 등록된 캐릭터가 없다.
          <br />
          <span className="text-text-faint">
            편성표 칸에 닉네임을 넣으면 자동으로 등록된다. 여기서 미리 넣어둘 수도 있다.
          </span>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, list]) => (
            <section key={label || "__none__"} className="space-y-2">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                <span className={label ? "text-text" : "text-text-faint"}>
                  {label || "소속 미지정"}
                </span>
                <span className="text-xs text-text-faint tabular">{list.length}</span>
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

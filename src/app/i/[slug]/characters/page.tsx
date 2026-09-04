import { listCharacters } from "@/lib/characters";
import { requireInstance } from "@/lib/instance";

import { CharacterCard } from "./CharacterCard";
import { RegisterPanel } from "./RegisterPanel";

export const dynamic = "force-dynamic";

export default async function CharactersPage({ params }: PageProps<"/i/[slug]/characters">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);
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
          닉네임만 넣으면 클래스·템레벨·전투력·직업 각인·아크그리드를 로아 API에서 가져온다.
        </p>
      </div>

      <RegisterPanel slug={slug} />

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
        {failed > 0 && (
          <span className="text-danger">조회 실패 {failed}</span>
        )}
      </div>

      {characters.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          아직 등록된 캐릭터가 없다. 위에서 닉네임을 넣어 시작한다.
          <br />
          <span className="text-text-faint">
            원정대 불러오기를 쓰면 부캐까지 한 번에 고를 수 있다.
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

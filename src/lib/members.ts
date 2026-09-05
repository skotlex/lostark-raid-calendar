import "server-only";

import { prisma } from "./prisma";

/**
 * 원정대 클레임 — "이 캐릭터들은 내 것"이라고 한 번 선언하는 일.
 *
 * 로아 API에는 **캐릭터의 주인이 없다.** siblings는 "이 캐릭터와 같은 계정에 있는
 * 캐릭터들"을 알려줄 뿐, 그 계정이 누구 것인지는 말해주지 않는다. 그래서 첫 번째 사람이
 * 자기 것이라고 말하면 그대로 믿는다. 선착순 자기 신고이고, 어떻게 붙여도 못 막는다.
 * 신뢰가 "익명"에서 "검증된 디코 계정"으로 오를 뿐이다(CLAUDE.md 4장).
 *
 * 클레임한 이름은 `Member.claimedNames`에 쌓아 둔다. 나중에 편성 칸에 남이 대신
 * 넣어줘도 그 이름이 목록에 있으면 소속이 붙는다. 이게 클레임의 진짜 이득이다.
 *
 * **계정이 여럿인 사람이 있다.** siblings는 한 계정만 주고 부계정을 이어 붙일 방법이
 * API에 없다. 그래서 클레임을 여러 번 할 수 있게 두고 이름을 계속 쌓는다.
 */
export interface ClaimResult {
  /** 이번에 새로 목록에 들어온 캐릭터 수 */
  added: number;
  /** 이번에 소속이 붙은, 이미 등록돼 있던 캐릭터 수 */
  linked: number;
  /** 묶고 난 뒤 목록에 있는 전체 캐릭터 수 */
  total: number;
}

export interface MyMember {
  id: string;
  label: string;
  claimedNames: string[];
  /** 실제로 등록돼 있고 나에게 묶인 캐릭터 수 */
  characterCount: number;
}

/** 내 Member. 아직 클레임하지 않았으면 null. */
export async function findMyMember(
  instanceId: string,
  discordUserId: string,
): Promise<MyMember | null> {
  const member = await prisma.member.findFirst({
    where: { instanceId, discordUserId },
    select: {
      id: true,
      label: true,
      claimedNames: true,
      _count: { select: { characters: true } },
    },
  });
  if (!member) return null;

  return {
    id: member.id,
    label: member.label,
    claimedNames: member.claimedNames,
    characterCount: member._count.characters,
  };
}

/**
 * 이름으로 사람을 찾거나 만든다.
 *
 * 라벨이 유일 키라, 디코 닉네임으로 이미 만들어져 있던 사람(캐릭터 관리에서 등록하며
 * 생긴 행)이 있으면 그 행에 디코 계정을 붙인다. 새로 만들면 같은 이름이 둘이 된다.
 */
async function upsertMyMember(
  instanceId: string,
  discordUserId: string,
  label: string,
): Promise<{ id: string; claimedNames: string[] }> {
  const mine = await prisma.member.findFirst({
    where: { instanceId, discordUserId },
    select: { id: true, claimedNames: true },
  });
  if (mine) return mine;

  return prisma.member.upsert({
    where: { instanceId_label: { instanceId, label } },
    update: { discordUserId },
    create: { instanceId, label, discordUserId },
    select: { id: true, claimedNames: true },
  });
}

/**
 * 이름 목록을 내 것으로 묶는다.
 *
 * **원정대 불러오기와 한 명씩 등록이 이 함수를 거친다.** 등록하는 사람이 곧 주인이라고
 * 보는 자리이기 때문이다. 편성 칸에 남의 닉네임을 쳐 넣는 경로만 예외로 두고 무소속으로
 * 남긴다(characters.ts).
 *
 * 이름은 `Member.claimedNames`에 쌓인다. 나중에 같은 이름이 등록되면 자동으로 붙으므로,
 * 남이 편성 칸에 대신 넣어줘도 소속이 잡힌다.
 *
 * 계정이 여럿인 사람은 계정마다 한 번씩 불러오면 된다. 이름이 계속 쌓이는 구조라 그대로
 * 동작한다. 로아 `siblings`가 부계정을 이어주지 않아 이 방법뿐이다.
 */
export async function claimNames(params: {
  instanceId: string;
  discordUserId: string;
  label: string;
  names: string[];
  /**
   * 원정대 이름. 불러오기로 들어온 경우에만 있다.
   *
   * **불러오기 한 번이 원정대 하나다.** 골드 6명 제한이 원정대 단위라 경계가 필요한데,
   * 로아 API에 계정을 잇는 값이 없어서 사람이 계정마다 한 번씩 부르는 것이 곧 경계가
   * 된다(goldEarners.ts). 한 명씩 등록하는 경로는 어느 원정대인지 알 수 없어 비운다.
   */
  rosterLabel?: string;
}): Promise<ClaimResult> {
  const wanted = params.names.map((n) => n.trim()).filter(Boolean);
  if (wanted.length === 0) return { added: 0, linked: 0, total: 0 };

  const member = await upsertMyMember(params.instanceId, params.discordUserId, params.label);

  const names = new Set(member.claimedNames);
  const before = names.size;
  for (const name of wanted) names.add(name);

  const claimedNames = [...names];
  await prisma.member.update({
    where: { id: member.id },
    data: { claimedNames },
  });

  // 이미 등록돼 있던 캐릭터에 소속을 붙인다. 남이 칸에 쳐 넣어 만들어진 것들이다.
  const linked = await prisma.character.updateMany({
    where: { instanceId: params.instanceId, name: { in: claimedNames }, memberId: null },
    data: { memberId: member.id },
  });

  const rosterLabel = params.rosterLabel?.trim();
  if (rosterLabel) {
    const roster = await prisma.roster.upsert({
      where: { instanceId_label: { instanceId: params.instanceId, label: rosterLabel } },
      create: { instanceId: params.instanceId, memberId: member.id, label: rosterLabel },
      update: { memberId: member.id },
      select: { id: true },
    });

    /*
     * 이번에 부른 이름들만 이 원정대로 옮긴다.
     *
     * 같은 원정대를 다시 부르면 그 사이 새로 키운 캐릭터가 따라 들어온다. 반대로 다른
     * 원정대를 부를 때 이미 붙어 있던 캐릭터를 빼앗지는 않는다 — 이름이 겹칠 수 없으니
     * 넘어올 일 자체가 없고, 혹시 사람이 원정대를 잘못 불렀더라도 앞의 지정이 통째로
     * 흔들리는 편이 더 나쁘다.
     */
    await prisma.character.updateMany({
      where: { instanceId: params.instanceId, name: { in: wanted } },
      data: { rosterId: roster.id },
    });
  }

  return {
    added: claimedNames.length - before,
    linked: linked.count,
    total: claimedNames.length,
  };
}

/**
 * 이름으로 주인을 찾는다. 캐릭터를 새로 등록할 때 소속을 붙이는 데 쓴다.
 *
 * 클레임한 사람이 없으면 null이고, 그 캐릭터는 소속 미지정으로 남는다.
 */
export async function findOwnerByCharacterName(
  instanceId: string,
  characterName: string,
): Promise<string | null> {
  const member = await prisma.member.findFirst({
    where: { instanceId, claimedNames: { has: characterName } },
    select: { id: true },
  });
  return member?.id ?? null;
}

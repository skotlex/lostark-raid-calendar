import "server-only";

import { CharacterError } from "./characters";
import { logEvent } from "./history";
import { fetchSiblings } from "./lostark";
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
  /** 클레임을 마친 뒤 목록에 있는 전체 캐릭터 수 */
  total: number;
  /** 원정대 대표로 조회한 이름 */
  searched: string;
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
 * 원정대를 통째로 내 것으로 묶는다. 요청 1회(siblings)만 쓴다.
 *
 * 여기서 캐릭터를 새로 등록하지는 않는다. 원정대에는 저렙 부캐가 스물몇 개씩 들어 있어
 * 전부 등록하면 목록이 그걸로 덮이고 API 요청도 그만큼 나간다. 등록은 캐릭터 관리의
 * `원정대 불러오기`에서 고를 것만 한다.
 */
export async function claimRoster(params: {
  instanceId: string;
  discordUserId: string;
  label: string;
  representative: string;
}): Promise<ClaimResult> {
  const searched = params.representative.trim();
  if (!searched) throw new CharacterError("원정대의 대표 캐릭터 닉네임을 입력해 주세요");

  const siblings = await fetchSiblings(searched);
  if (siblings.length === 0) {
    throw new CharacterError(`'${searched}' 원정대를 찾을 수 없습니다. 닉네임을 확인해 주세요`);
  }

  const member = await upsertMyMember(params.instanceId, params.discordUserId, params.label);

  // 조회한 이름도 함께 넣는다. 대표가 원정대 목록에 빠지는 경우를 본 적은 없지만,
  // 빠져 있으면 정작 자기가 친 캐릭터만 소속이 없는 이상한 상태가 된다.
  const names = new Set(member.claimedNames);
  const before = names.size;
  names.add(searched);
  for (const sibling of siblings) names.add(sibling.CharacterName);

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

  await logEvent({
    instanceId: params.instanceId,
    action: "member_claim",
    actorLabel: params.label,
    detail: { searched, total: claimedNames.length, linked: linked.count },
  });

  return {
    added: claimedNames.length - before,
    linked: linked.count,
    total: claimedNames.length,
    searched,
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

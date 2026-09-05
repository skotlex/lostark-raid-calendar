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
   * 된다(goldEarners.ts). 한 명씩 등록하는 경로는 이름을 모르므로 `rosterId`를 쓴다.
   */
  rosterLabel?: string;
  /**
   * 이미 있는 내 원정대. 한 명씩 등록에서 고른 값이다.
   *
   * 그 경로는 캐릭터 하나만 받아 어느 계정인지 알 수 없다. 그래서 사람이 직접 고르고,
   * 여기서는 **원정대를 만들지 않는다** — 만들 수 있게 하면 오타 하나가 유령 원정대가
   * 되고 골드 6명 계산이 그만큼 갈라진다. 만드는 곳은 불러오기 한 곳뿐이다.
   */
  rosterId?: string;
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

  const rosterId = await resolveRoster(params.instanceId, member.id, params);
  if (rosterId) {
    /*
     * 이번에 부른 이름들만 이 원정대로 옮긴다.
     *
     * 같은 원정대를 다시 부르면 그 사이 새로 키운 캐릭터가 따라 들어온다. 반대로 다른
     * 원정대를 부를 때 이미 붙어 있던 캐릭터를 빼앗지는 않는다 — 이름이 겹칠 수 없으니
     * 넘어올 일 자체가 없고, 혹시 사람이 원정대를 잘못 불렀더라도 앞의 지정이 통째로
     * 흔들리는 편이 더 나쁘다.
     *
     * **내 캐릭터만 옮긴다.** 바로 위에서 주인 없는 것들에 소속을 붙였으니, 그러고도
     * 남의 것이면 이름을 잘못 친 것이다. 그대로 옮기면 원정대는 내 것인데 소속은 남인
     * 캐릭터가 생겨 주인의 골드 묶음에서 조용히 빠진다.
     */
    await prisma.character.updateMany({
      where: { instanceId: params.instanceId, name: { in: wanted }, memberId: member.id },
      data: { rosterId },
    });
  }

  return {
    added: claimedNames.length - before,
    linked: linked.count,
    total: claimedNames.length,
  };
}

/**
 * 이번 클레임이 어느 원정대로 가는지 정한다. 없으면 null이고 캐릭터는 원정대 없이 남는다.
 *
 * 이름(`rosterLabel`)은 불러오기가 준다. 그 한 번이 원정대 하나라 없으면 만든다.
 * 아이디(`rosterId`)는 한 명씩 등록에서 사람이 고른 것이다. **내 원정대인지 확인한다** —
 * 서버 액션은 UI를 거치지 않고 불릴 수 있어 화면이 보여준 목록을 그대로 믿으면 안 된다
 * (setGoldEarners와 같은 이유).
 *
 * **이름이 겹쳐도 남의 원정대는 건드리지 않는다.** 라벨은 조회할 때 친 대표 캐릭터명이라
 * 같은 원정대를 두 사람이 부르면 정확히 겹친다. 그때 주인을 갈아치우면 원래 주인의
 * 캐릭터는 `rosterId`가 그대로라 `listMyRosters`에도 `원정대 미지정`에도 안 잡혀
 * **골드 지정 화면에서 통째로 사라진다.** 붙이지 않고 미지정으로 남기는 편이 낫다.
 * 미지정은 최소한 화면에 줄로 보인다.
 */
async function resolveRoster(
  instanceId: string,
  memberId: string,
  params: { rosterLabel?: string; rosterId?: string },
): Promise<string | null> {
  const label = params.rosterLabel?.trim();
  if (label) {
    const existing = await prisma.roster.findUnique({
      where: { instanceId_label: { instanceId, label } },
      select: { id: true, memberId: true },
    });
    if (existing) return existing.memberId === memberId ? existing.id : null;

    const roster = await prisma.roster.create({
      data: { instanceId, memberId, label },
      select: { id: true },
    });
    return roster.id;
  }

  const id = params.rosterId?.trim();
  if (!id) return null;

  const roster = await prisma.roster.findFirst({
    where: { id, instanceId, memberId },
    select: { id: true },
  });
  return roster?.id ?? null;
}

/**
 * 이름으로 주인을 찾는다. 캐릭터를 새로 등록할 때 소속을 붙이는 데 쓴다.
 *
 * 클레임한 사람이 없으면 null이고, 그 캐릭터는 소속 미지정으로 남는다.
 *
 * **먼저 클레임한 사람이 이긴다**(4장). 한 이름을 두 사람이 클레임한 데이터가 이미
 * 있을 수 있어서 — 예전 단일 등록이 남의 캐릭터 이름도 그대로 쌓았다 — 정렬 없이
 * 두면 같은 질문에 매번 다른 답이 나온다.
 */
export async function findOwnerByCharacterName(
  instanceId: string,
  characterName: string,
): Promise<string | null> {
  const member = await prisma.member.findFirst({
    where: { instanceId, claimedNames: { has: characterName } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return member?.id ?? null;
}

/**
 * 내 원정대 목록. 캐릭터 관리의 탭이 된다.
 *
 * 원정대가 없는 캐릭터(편성 칸으로 만들어진 것들)는 여기 안 나온다. 화면이 별도의
 * "미지정" 탭으로 따로 붙인다 — 진짜 원정대가 아니라 아직 안 붙은 것들이라
 * 이름을 가진 원정대와 같은 줄에 세우면 계정을 하나 더 가진 것처럼 읽힌다.
 */
export async function listMyRosters(
  instanceId: string,
  memberId: string,
): Promise<{ id: string; label: string }[]> {
  return prisma.roster.findMany({
    where: { instanceId, memberId },
    select: { id: true, label: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * 이 원정대의 골드 획득 캐릭터를 지정한다.
 *
 * **원정대 전체에 true/false를 박는다.** 일부만 박아 두면 자동과 수동이 섞여
 * "지정한 둘 + 자동 넷"이 되는데, 그 넷이 왜 그 넷인지 화면에서 설명할 수 없다.
 *
 * `rosterId`가 null이면 아직 원정대가 안 붙은 내 캐릭터들이다. 화면의 "미지정" 탭이
 * 그것들을 보여주므로 여기서도 같은 조건으로 잡는다.
 *
 * 남의 캐릭터를 건드리지 못하도록 memberId로 한 번 더 좁힌다. 서버 액션은 UI를 거치지
 * 않고 불릴 수 있어 화면이 보여준 목록을 그대로 믿으면 안 된다.
 */
export async function setGoldEarners(params: {
  instanceId: string;
  memberId: string;
  rosterId: string | null;
  earnerIds: string[];
}): Promise<void> {
  const scope = {
    instanceId: params.instanceId,
    memberId: params.memberId,
    rosterId: params.rosterId,
  };
  const ids = new Set(params.earnerIds);

  const mine = await prisma.character.findMany({
    where: scope,
    select: { id: true },
  });

  const earners = mine.filter((c) => ids.has(c.id)).map((c) => c.id);
  const others = mine.filter((c) => !ids.has(c.id)).map((c) => c.id);

  await prisma.$transaction([
    prisma.character.updateMany({ where: { id: { in: earners } }, data: { goldEarner: true } }),
    prisma.character.updateMany({ where: { id: { in: others } }, data: { goldEarner: false } }),
  ]);
}

/** 지정을 지워 자동(템레벨 상위 6)으로 되돌린다. */
export async function clearGoldEarners(params: {
  instanceId: string;
  memberId: string;
  rosterId: string | null;
}): Promise<void> {
  await prisma.character.updateMany({
    where: {
      instanceId: params.instanceId,
      memberId: params.memberId,
      rosterId: params.rosterId,
    },
    data: { goldEarner: null },
  });
}

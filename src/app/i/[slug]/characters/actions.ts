"use server";

import { revalidatePath } from "next/cache";

import {
  type BulkResult,
  CharacterError,
  type SiblingPreview,
  deleteCharacter,
  deleteMemberCharacters,
  deleteRosterCharacters,
  previewSiblings,
  registerCharacter,
  registerCharacters,
  type BulkProgress,
  syncAllBatch,
  syncCharacter,
} from "@/lib/characters";
import { logEvent } from "@/lib/history";
import { findInstance } from "@/lib/instance";
import { GOLD_LIMIT } from "@/lib/goldEarners";
import { claimNames, clearGoldEarners, findMyMember, setGoldEarners } from "@/lib/members";
import { type Session, requireSession } from "@/lib/session";

/*
 * 서버 액션은 UI를 거치지 않고 POST로 직접 호출될 수 있다.
 *
 * **레이아웃의 입장 검사를 거치지 않으므로 여기서 다시 확인한다.** 어떤 인스턴스의
 * 데이터인지도 서버에서 다시 확인한다. 클라이언트가 보낸 id를 그대로 믿지 않는다.
 */
async function authorize(slug: unknown): Promise<{ instanceId: string; session: Session }> {
  const session = await requireSession();
  if (typeof slug !== "string" || !slug) throw new CharacterError("잘못된 요청입니다");
  const instance = await findInstance(slug);
  if (!instance) throw new CharacterError("인스턴스를 찾을 수 없습니다");
  return { instanceId: instance.id, session };
}

function refresh(slug: string) {
  revalidatePath(`/i/${slug}/characters`);
  revalidatePath(`/i/${slug}`);
}

/** 예상 가능한 실패는 메시지로 돌려주고, 그 외는 그대로 던져 에러 화면에 맡긴다. */
function toMessage(error: unknown): string {
  if (error instanceof CharacterError) return error.message;
  throw error;
}

// --- 단일 등록 ---------------------------------------------------------------

export interface RegisterState {
  status: "idle" | "ok" | "error";
  message: string;
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "");
  // 화면에서 고른 내 원정대. 비어 있으면 원정대 없이 등록된다(members.ts).
  const rosterId = String(formData.get("roster") ?? "");

  try {
    /*
     * 여기서 등록하면 **등록한 사람이 주인이다.**
     *
     * 캐릭터 관리는 자기 캐릭터를 챙기는 화면이라 그렇게 본다. 남의 캐릭터를 대신
     * 넣는 일은 편성 칸에서 일어나고, 그 경로만 무소속으로 남긴다(board.ts).
     */
    const { instanceId, session } = await authorize(slug);
    const character = await registerCharacter(instanceId, name);

    /*
     * **이미 주인이 있으면 클레임하지 않는다.**
     *
     * 캐릭터의 소속은 registerCharacter가 이미 지켜준다(클레임한 사람이 먼저다).
     * 여기서 막는 것은 `claimedNames`에 남의 이름이 쌓이는 것이다. 쌓이면 한 이름을
     * 두 사람이 클레임한 상태가 되어, 그 캐릭터가 나중에 다시 만들어질 때 누구에게
     * 붙을지가 흔들린다(findOwnerByCharacterName).
     *
     * 등록 자체를 실패로 돌리지는 않는다. 이름을 치기 전에는 남의 것인지 알 수 없고
     * API 호출은 이미 나간 뒤다. 스펙이 최신이 되는 것은 누구에게도 해가 없다.
     */
    const mine = await findMyMember(instanceId, session.discordUserId);
    const others = character.memberId !== null && character.memberId !== mine?.id;

    if (!others) {
      await claimNames({
        instanceId,
        discordUserId: session.discordUserId,
        label: session.label,
        names: [character.name],
        rosterId,
      });
    }

    // 남의 캐릭터라도 이력은 남긴다. 그 이름이 여기서 처음 만들어졌을 수 있다.
    await logEvent({
      instanceId,
      action: "character_add",
      actorLabel: session.label,
      detail: { character: character.name },
    });
    refresh(slug);
    return {
      status: "ok",
      message: others
        ? `${character.name}은(는) ${character.memberLabel ?? "다른 분"}님의 캐릭터입니다. 내 캐릭터로 묶지 않았습니다`
        : `${character.name} (${character.className ?? "?"}) 등록됨`,
    };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

// --- 원정대 불러오기 ---------------------------------------------------------

export interface SiblingsState {
  status: "idle" | "ok" | "error";
  message: string;
  /** 조회한 원정대 대표 닉네임. 사람 이름 기본값으로 쓴다 */
  searched: string;
  siblings: SiblingPreview[];
  /** 이 원정대를 이미 클레임한 다른 사람. 있으면 화면이 목록을 통째로 잠근다 */
  owner: string | null;
  /** 이 계정이 이미 붙어 있는 내 원정대. 있으면 그 행으로 넣는다(lib/characters.ts) */
  roster: { id: string; label: string } | null;
}

export async function previewSiblingsAction(
  _prev: SiblingsState,
  formData: FormData,
): Promise<SiblingsState> {
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "");

  try {
    const { instanceId, session } = await authorize(slug);
    // 내 원정대를 다시 부르는 것과 남의 것을 부르는 것을 가르려면 내가 누구인지 알아야 한다.
    const mine = await findMyMember(instanceId, session.discordUserId);
    const { siblings, owner, roster, searched } = await previewSiblings(
      instanceId,
      name,
      mine?.id ?? null,
    );
    return {
      status: "ok",
      // 주인이 있으면 "골라 주세요"라고 하지 않는다. 고를 수 있는 것이 없다.
      // 왜 못 고르는지는 목록 위 안내가 말한다(RegisterPanel).
      message: owner
        ? `${siblings.length}개 캐릭터를 찾았습니다`
        : `${siblings.length}개 캐릭터를 찾았습니다. 등록할 캐릭터를 골라 주세요`,
      // 사람이 친 것이 아니라 로아가 준 표기다. 이 이름이 그대로 원정대 이름이 된다.
      searched,
      siblings,
      owner,
      roster,
    };
  } catch (error) {
    return {
      status: "error",
      message: toMessage(error),
      searched: "",
      siblings: [],
      owner: null,
      roster: null,
    };
  }
}

// --- 선택한 캐릭터 일괄 등록 --------------------------------------------------

export interface ImportState {
  status: "idle" | "ok" | "error";
  message: string;
  result: BulkResult | null;
}

export async function importSiblingsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const slug = String(formData.get("slug") ?? "");
  const names = formData.getAll("names").map(String).filter(Boolean);
  // 조회한 대표 캐릭터의 정식 표기. 이 한 번이 원정대 하나가 된다(members.ts).
  const rosterLabel = String(formData.get("roster") ?? "");
  // 이 계정이 이미 쓰던 원정대. 있으면 그 행으로 들어가고 이름만 위 표기로 맞춘다.
  const rosterId = String(formData.get("rosterId") ?? "");

  if (names.length === 0) {
    return { status: "error", message: "등록할 캐릭터를 하나 이상 골라 주세요", result: null };
  }

  try {
    const { instanceId, session } = await authorize(slug);
    const result = await registerCharacters(instanceId, names);
    if (result.added.length > 0) {
      // 내 원정대에서 고른 것들이다. 등록과 동시에 내 소속으로 묶는다.
      await claimNames({
        instanceId,
        discordUserId: session.discordUserId,
        label: session.label,
        names: result.added,
        rosterLabel,
        rosterId,
      });
    }
    if (result.added.length > 0) {
      // 원정대 등록은 한 번에 여럿이다. 줄을 여럿 남기면 이력이 그 사람 부캐로 덮인다.
      await logEvent({
        instanceId,
        action: "character_add",
        actorLabel: session.label,
        detail: { character: result.added.join(", "), count: result.added.length },
      });
    }
    refresh(slug);

    const parts = [`${result.added.length}개 등록됨`];
    if (result.failed.length > 0) parts.push(`${result.failed.length}개 실패`);
    return { status: "ok", message: parts.join(" / "), result };
  } catch (error) {
    return { status: "error", message: toMessage(error), result: null };
  }
}

// --- 개별 조작 ---------------------------------------------------------------

export interface RowState {
  status: "idle" | "ok" | "error";
  message: string;
}

export async function syncAction(_prev: RowState, formData: FormData): Promise<RowState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");

  try {
    const { instanceId } = await authorize(slug);
    // 버튼을 눌렀다는 건 지금 최신값을 원한다는 뜻이므로 캐시를 무시한다.
    const character = await syncCharacter(instanceId, id, { force: true });
    refresh(slug);
    return character.syncError
      ? { status: "error", message: character.syncError }
      : { status: "ok", message: `${character.name} 갱신됨` };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

export async function deleteAction(_prev: RowState, formData: FormData): Promise<RowState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");

  try {
    const { instanceId, session } = await authorize(slug);
    const name = await deleteCharacter(instanceId, id);
    if (name) {
      await logEvent({
        instanceId,
        action: "character_delete",
        actorLabel: session.label,
        detail: { character: name },
      });
    }
    refresh(slug);
    return { status: "ok", message: "삭제됨" };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

/**
 * 한 사람의 캐릭터를 통째로 지운다.
 *
 * 확인은 화면에서 받는다(되돌릴 수 없고 편성 기록까지 사라진다).
 */
export async function deleteMemberAction(
  _prev: RowState,
  formData: FormData,
): Promise<RowState> {
  const slug = String(formData.get("slug") ?? "");
  const label = String(formData.get("label") ?? "");

  try {
    const { instanceId, session } = await authorize(slug);
    const names = await deleteMemberCharacters(instanceId, label);
    await logEvent({
      instanceId,
      action: "character_delete_many",
      actorLabel: session.label,
      // 무엇이 사라졌는지 남긴다. 되돌릴 수 없는 일이라 수만 남기면 확인할 길이 없다.
      detail: { member: label, count: names.length, characters: names.join(", ") },
    });
    refresh(slug);
    return { status: "ok", message: `${names.length}개 삭제됨` };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

/**
 * 한 사람의 원정대 하나만 지운다. 탭 단위 삭제다.
 *
 * `roster`가 비어 있으면 그 사람의 **원정대 미지정** 묶음이다(lib/characters.ts).
 * 확인은 묶음 전체 삭제와 마찬가지로 화면에서 받는다.
 */
export async function deleteRosterAction(
  _prev: RowState,
  formData: FormData,
): Promise<RowState> {
  const slug = String(formData.get("slug") ?? "");
  const roster = String(formData.get("roster") ?? "");
  const label = String(formData.get("label") ?? "");
  const rosterLabel = String(formData.get("rosterLabel") ?? "");

  try {
    const { instanceId, session } = await authorize(slug);
    const names = await deleteRosterCharacters(instanceId, {
      rosterId: roster || null,
      memberLabel: label,
    });
    await logEvent({
      instanceId,
      action: "character_delete_many",
      actorLabel: session.label,
      detail: {
        member: label,
        roster: rosterLabel,
        count: names.length,
        characters: names.join(", "),
      },
    });
    refresh(slug);
    return { status: "ok", message: `${names.length}개 삭제됨` };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

/**
 * 전체 갱신 한 회차.
 * 정규화 형식이 바뀌었을 때(예: 아크그리드 단계 추가) 옛 데이터를 되살리는 수단이다.
 *
 * 캐릭터가 많으면 한 번에 다 돌지 못한다(분당 한도, 서버리스 실행 시간). 화면이
 * `remaining`이 0이 될 때까지 이어 부른다. `startedAt`은 첫 회차에 정해 계속 넘긴다.
 */
export async function syncAllAction(
  slug: string,
  startedAt: string,
): Promise<BulkProgress> {
  const { instanceId } = await authorize(slug);
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) throw new CharacterError("잘못된 요청입니다");

  const progress = await syncAllBatch(instanceId, started);
  // 회차마다 부르면 남은 회차가 도는 동안 이 무거운 화면이 그만큼 다시 그려지고,
  // 그동안 다음 회차가 늦어진다. 화면에 남는 것은 마지막 상태뿐이라 끝에 한 번만 한다.
  if (progress.remaining === 0) refresh(slug);
  return progress;
}

// --- 골드 획득 캐릭터 지정 ---------------------------------------------------

export interface GoldState {
  status: "idle" | "ok" | "error";
  message: string;
}

/**
 * 이 원정대에서 골드를 받는 캐릭터를 정한다.
 *
 * `roster`가 빈 문자열이면 아직 원정대가 안 붙은 내 캐릭터 묶음이다(goldEarners.ts의
 * NO_ROSTER). 화면의 "미지정" 탭이 그것들을 보여준다.
 *
 * 고른 것이 하나도 없으면 지정을 지워 자동으로 되돌린다. "아무도 안 받는다"는 상태는
 * 게임에 없으므로 그 뜻으로 읽을 수 없고, 전부 해제하는 동작에 되돌리기를 걸어 두면
 * 버튼을 하나 덜 만들어도 된다.
 */
export async function setGoldEarnersAction(
  _prev: GoldState,
  formData: FormData,
): Promise<GoldState> {
  const slug = String(formData.get("slug") ?? "");
  const roster = String(formData.get("roster") ?? "");
  const ids = formData.getAll("earner").map(String).filter(Boolean);

  try {
    const { instanceId, session } = await authorize(slug);
    const member = await findMyMember(instanceId, session.discordUserId);
    if (!member) {
      throw new CharacterError("먼저 캐릭터 관리에서 내 원정대를 불러와 주세요");
    }
    if (ids.length > GOLD_LIMIT) {
      throw new CharacterError(`골드를 받는 캐릭터는 ${GOLD_LIMIT}명까지입니다`);
    }

    const rosterId = roster || null;
    if (ids.length === 0) {
      await clearGoldEarners({ instanceId, memberId: member.id, rosterId });
    } else {
      await setGoldEarners({ instanceId, memberId: member.id, rosterId, earnerIds: ids });
    }

    refresh(slug);
    revalidatePath(`/i/${slug}/homework`);
    return {
      status: "ok",
      message: ids.length === 0 ? "자동(템레벨 상위 6)으로 되돌렸습니다" : "저장했습니다",
    };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

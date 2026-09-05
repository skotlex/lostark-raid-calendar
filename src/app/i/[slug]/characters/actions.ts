"use server";

import { revalidatePath } from "next/cache";

import {
  type BulkResult,
  CharacterError,
  type SiblingPreview,
  deleteCharacter,
  previewSiblings,
  registerCharacter,
  registerCharacters,
  type BulkProgress,
  syncAllBatch,
  syncCharacter,
} from "@/lib/characters";
import { findInstance } from "@/lib/instance";
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

  try {
    // 부캐를 묶는 이름은 들어와 있는 사람의 디스코드 닉네임이다. 물어보지 않는다.
    const { instanceId, session } = await authorize(slug);
    const character = await registerCharacter(instanceId, name, session.label);
    refresh(slug);
    return {
      status: "ok",
      message: `${character.name} (${character.className ?? "?"}) 등록됨`,
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
}

export async function previewSiblingsAction(
  _prev: SiblingsState,
  formData: FormData,
): Promise<SiblingsState> {
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "");

  try {
    const { instanceId } = await authorize(slug);
    const siblings = await previewSiblings(instanceId, name);
    return {
      status: "ok",
      message: `${siblings.length}개 캐릭터를 찾았습니다. 등록할 캐릭터를 골라 주세요`,
      searched: name.trim(),
      siblings,
    };
  } catch (error) {
    return { status: "error", message: toMessage(error), searched: "", siblings: [] };
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

  if (names.length === 0) {
    return { status: "error", message: "등록할 캐릭터를 하나 이상 골라 주세요", result: null };
  }

  try {
    const { instanceId, session } = await authorize(slug);
    const result = await registerCharacters(instanceId, names, session.label);
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
    const { instanceId } = await authorize(slug);
    await deleteCharacter(instanceId, id);
    refresh(slug);
    return { status: "ok", message: "삭제됨" };
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
  refresh(slug);
  return progress;
}

"use server";

import { revalidatePath } from "next/cache";

import { BoardError, assignByName, moveAssignment, setPinned, unassign } from "@/lib/board";
import { syncStaleCharacters } from "@/lib/characters";
import { findInstance } from "@/lib/instance";
import { type Session, requireSession } from "@/lib/session";
import { SlotError, setKeepRoster } from "@/lib/slots";
import { parseWeekParam } from "@/lib/week";

/**
 * 서버 액션은 UI를 거치지 않고 POST로 직접 호출될 수 있다.
 *
 * **레이아웃의 입장 검사를 거치지 않으므로 여기서 다시 확인한다.** 액션마다 흩어두면
 * 하나 빠뜨렸을 때 조용히 열리므로 모든 액션이 지나는 이 한 곳에 둔다.
 *
 * 편집자 이름도 폼이 아니라 세션에서 읽는다. 폼으로 받으면 아무 이름이나 적어 보낼 수
 * 있어 기록이 의미를 잃는다.
 */
async function authorize(slug: unknown): Promise<{ instanceId: string; session: Session }> {
  if (typeof slug !== "string" || !slug) throw new BoardError("잘못된 요청입니다");
  const session = await requireSession();
  const instance = await findInstance(slug);
  if (!instance) throw new BoardError("인스턴스를 찾을 수 없습니다");
  return { instanceId: instance.id, session };
}

/** 예상 가능한 실패만 메시지로 돌려주고, 나머지는 에러 화면에 맡긴다. */
function toMessage(error: unknown): string {
  if (error instanceof BoardError || error instanceof SlotError) return error.message;
  throw error;
}

/**
 * 오래된 스펙을 자동으로 갱신한다. 화면이 열릴 때 AutoSync가 한 번 부른다.
 *
 * 조회가 몇 초 걸릴 수 있어 렌더를 막지 않고 뒤에서 돌린다. 끝나면 화면을 다시 그린다.
 */
export async function syncStaleAction(slug: string): Promise<number> {
  const { instanceId } = await authorize(slug);
  const synced = await syncStaleCharacters(instanceId);
  if (synced > 0) {
    revalidatePath(`/i/${slug}`);
    revalidatePath(`/i/${slug}/characters`);
  }
  return synced;
}

export interface CellState {
  status: "idle" | "ok" | "error";
  message: string;
}

const OK: CellState = { status: "ok", message: "" };

/**
 * 칸에 닉네임을 넣어 배치한다.
 *
 * 등록되지 않은 닉네임이면 이 안에서 로아 API 조회와 등록까지 끝낸다.
 * 사용자는 "캐릭터 등록"이라는 단계를 따로 겪지 않는다.
 */
export async function assignAction(
  _prev: CellState,
  formData: FormData,
): Promise<CellState> {
  const slug = String(formData.get("slug") ?? "");

  try {
    const { instanceId, session } = await authorize(slug);
    const { created } = await assignByName({
      instanceId,
      slotId: String(formData.get("slotId") ?? ""),
      weekStart: parseWeekParam(String(formData.get("week") ?? "")),
      position: String(formData.get("position") ?? ""),
      characterName: String(formData.get("characterName") ?? ""),
      actorLabel: session.label,
    });
    revalidatePath(`/i/${slug}`);
    return created ? { status: "ok", message: "새 캐릭터를 조회해 등록했습니다" } : OK;
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

export async function unassignAction(
  _prev: CellState,
  formData: FormData,
): Promise<CellState> {
  const slug = String(formData.get("slug") ?? "");

  try {
    const { instanceId, session } = await authorize(slug);
    await unassign({
      instanceId,
      slotId: String(formData.get("slotId") ?? ""),
      weekStart: parseWeekParam(String(formData.get("week") ?? "")),
      position: String(formData.get("position") ?? ""),
      actorLabel: session.label,
    });
    revalidatePath(`/i/${slug}`);
    return OK;
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

/**
 * 카드를 드래그해 옮긴다. 받는 자리가 차 있으면 맞바꾼다.
 *
 * 어느 자리에서 어디로 가는지를 모두 폼으로 받는다. 드롭을 받은 칸이 자기 자리를
 * `to`로, 끌려온 쪽을 `from`으로 넣는다.
 */
export async function moveAction(_prev: CellState, formData: FormData): Promise<CellState> {
  const slug = String(formData.get("slug") ?? "");

  try {
    const { instanceId, session } = await authorize(slug);
    await moveAssignment({
      instanceId,
      weekStart: parseWeekParam(String(formData.get("week") ?? "")),
      from: {
        slotId: String(formData.get("fromSlotId") ?? ""),
        position: String(formData.get("fromPosition") ?? ""),
      },
      to: {
        slotId: String(formData.get("toSlotId") ?? ""),
        position: String(formData.get("toPosition") ?? ""),
      },
      actorLabel: session.label,
    });
    revalidatePath(`/i/${slug}`);
    return OK;
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

/** 자리 단위 고정. 수요일 리셋 때 이 자리만 남는다. */
export async function pinAction(_prev: CellState, formData: FormData): Promise<CellState> {
  const slug = String(formData.get("slug") ?? "");

  try {
    const { instanceId } = await authorize(slug);
    await setPinned({
      instanceId,
      slotId: String(formData.get("slotId") ?? ""),
      weekStart: parseWeekParam(String(formData.get("week") ?? "")),
      position: String(formData.get("position") ?? ""),
      pinned: formData.get("pinned") === "true",
    });
    revalidatePath(`/i/${slug}`);
    return OK;
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

/** 레이드 단위 고정. 이 슬롯 전원이 다음 주로 넘어간다. */
export async function keepRosterAction(
  _prev: CellState,
  formData: FormData,
): Promise<CellState> {
  const slug = String(formData.get("slug") ?? "");

  try {
    const { instanceId } = await authorize(slug);
    await setKeepRoster(
      instanceId,
      String(formData.get("slotId") ?? ""),
      formData.get("keepRoster") === "true",
    );
    revalidatePath(`/i/${slug}`);
    revalidatePath(`/i/${slug}/pinned`);
    return OK;
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

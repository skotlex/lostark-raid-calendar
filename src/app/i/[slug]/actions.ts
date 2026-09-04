"use server";

import { revalidatePath } from "next/cache";

import { BoardError, assignByName, setPinned, unassign } from "@/lib/board";
import { findInstance } from "@/lib/instance";
import { SlotError, setKeepRoster } from "@/lib/slots";
import { parseWeekParam } from "@/lib/week";

/**
 * 서버 액션은 UI를 거치지 않고 POST로 직접 호출될 수 있다.
 * 어떤 인스턴스의 데이터인지는 항상 서버에서 다시 확인한다.
 */
async function resolveInstanceId(slug: unknown): Promise<string> {
  if (typeof slug !== "string" || !slug) throw new BoardError("잘못된 요청이다");
  const instance = await findInstance(slug);
  if (!instance) throw new BoardError("인스턴스를 찾을 수 없다");
  return instance.id;
}

/** 예상 가능한 실패만 메시지로 돌려주고, 나머지는 에러 화면에 맡긴다. */
function toMessage(error: unknown): string {
  if (error instanceof BoardError || error instanceof SlotError) return error.message;
  throw error;
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
    const instanceId = await resolveInstanceId(slug);
    const { created } = await assignByName({
      instanceId,
      slotId: String(formData.get("slotId") ?? ""),
      weekStart: parseWeekParam(String(formData.get("week") ?? "")),
      position: String(formData.get("position") ?? ""),
      characterName: String(formData.get("characterName") ?? ""),
      actorLabel: String(formData.get("actorLabel") ?? "") || null,
    });
    revalidatePath(`/i/${slug}`);
    return created ? { status: "ok", message: "새 캐릭터를 조회해 등록했다" } : OK;
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
    const instanceId = await resolveInstanceId(slug);
    await unassign({
      instanceId,
      slotId: String(formData.get("slotId") ?? ""),
      weekStart: parseWeekParam(String(formData.get("week") ?? "")),
      position: String(formData.get("position") ?? ""),
      actorLabel: String(formData.get("actorLabel") ?? "") || null,
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
    const instanceId = await resolveInstanceId(slug);
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
    const instanceId = await resolveInstanceId(slug);
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

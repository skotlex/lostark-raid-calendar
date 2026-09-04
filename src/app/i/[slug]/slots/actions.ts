"use server";

import { revalidatePath } from "next/cache";

import { findInstance } from "@/lib/instance";
import { requireSession } from "@/lib/session";
import { type SlotInput, SlotError, archiveSlot, createSlot, updateSlot } from "@/lib/slots";

async function resolveInstanceId(slug: unknown): Promise<string> {
  // 레이아웃의 입장 검사를 거치지 않는 경로다. 여기서 다시 확인한다.
  await requireSession();
  if (typeof slug !== "string" || !slug) throw new SlotError("잘못된 요청입니다");
  const instance = await findInstance(slug);
  if (!instance) throw new SlotError("인스턴스를 찾을 수 없습니다");
  return instance.id;
}

function toMessage(error: unknown): string {
  if (error instanceof SlotError) return error.message;
  throw error;
}

function readInput(formData: FormData): SlotInput {
  return {
    dayOfWeek: Number(formData.get("dayOfWeek")),
    startTime: String(formData.get("startTime") ?? "").trim(),
    raidName: String(formData.get("raidName") ?? ""),
    difficulty: String(formData.get("difficulty") ?? ""),
  };
}

export interface SlotState {
  status: "idle" | "ok" | "error";
  message: string;
}

export async function createSlotAction(
  _prev: SlotState,
  formData: FormData,
): Promise<SlotState> {
  const slug = String(formData.get("slug") ?? "");
  try {
    const instanceId = await resolveInstanceId(slug);
    const slot = await createSlot(instanceId, readInput(formData));
    revalidatePath(`/i/${slug}/slots`);
    revalidatePath(`/i/${slug}`);
    return { status: "ok", message: `${slot.raidName} 추가됨` };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

export async function updateSlotAction(
  _prev: SlotState,
  formData: FormData,
): Promise<SlotState> {
  const slug = String(formData.get("slug") ?? "");
  try {
    const instanceId = await resolveInstanceId(slug);
    await updateSlot(instanceId, String(formData.get("slotId") ?? ""), readInput(formData));
    revalidatePath(`/i/${slug}/slots`);
    revalidatePath(`/i/${slug}`);
    return { status: "ok", message: "저장됨" };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

/**
 * 슬롯을 목록에서 내린다. 실제로 지우지 않는다.
 * 지우면 과거 주차의 편성 기록까지 함께 사라진다.
 */
export async function archiveSlotAction(
  _prev: SlotState,
  formData: FormData,
): Promise<SlotState> {
  const slug = String(formData.get("slug") ?? "");
  try {
    const instanceId = await resolveInstanceId(slug);
    await archiveSlot(instanceId, String(formData.get("slotId") ?? ""));
    revalidatePath(`/i/${slug}/slots`);
    revalidatePath(`/i/${slug}`);
    return { status: "ok", message: "목록에서 내렸습니다" };
  } catch (error) {
    return { status: "error", message: toMessage(error) };
  }
}

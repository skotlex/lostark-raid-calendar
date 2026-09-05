"use server";

import { revalidatePath } from "next/cache";

import { HomeworkError, setHomeworkOrder } from "@/lib/homework";
import { findInstance } from "@/lib/instance";
import { findMyMember } from "@/lib/members";
import { requireSession } from "@/lib/session";

export interface HomeworkState {
  status: "idle" | "ok" | "error";
  message: string;
}

/**
 * 숙제 순서 저장.
 *
 * 순서가 곧 "어느 레이드에서 골드를 받을 것인가"다(homework.ts). 화면은 놓는 순간
 * 제 손으로 다시 계산해 두므로, 여기서는 그 결과를 굳히고 이 주의 다른 합계
 * (진행률·레이드별 현황)를 다시 그리게 한다.
 */
export async function reorderHomeworkAction(
  _prev: HomeworkState,
  formData: FormData,
): Promise<HomeworkState> {
  const slug = String(formData.get("slug") ?? "");
  try {
    // 레이아웃의 입장 검사를 거치지 않는 경로다. 여기서 다시 확인한다.
    const session = await requireSession();
    if (!slug) throw new HomeworkError("잘못된 요청입니다");

    const instance = await findInstance(slug);
    if (!instance) throw new HomeworkError("인스턴스를 찾을 수 없습니다");

    const member = await findMyMember(instance.id, session.discordUserId);
    await setHomeworkOrder(
      instance.id,
      member?.id ?? null,
      String(formData.get("characterId") ?? ""),
      String(formData.get("slotIds") ?? "")
        .split(",")
        .filter(Boolean),
    );

    revalidatePath(`/i/${slug}/homework`);
    return { status: "ok", message: "" };
  } catch (error) {
    if (error instanceof HomeworkError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

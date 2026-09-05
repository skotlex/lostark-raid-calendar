import type { DragEvent } from "react";

/**
 * 끌고 있는 것이 편성 칸이라는 표시.
 *
 * 전용 타입을 쓰면 dragover에서 "이건 받을 수 있는 것"인지 미리 가려낼 수 있다.
 * 브라우저 밖에서 끌어온 파일이나 글자에는 반응하지 않는다.
 *
 * 카드와 표가 같은 타입을 쓴다. 그래야 보기를 바꿔도 같은 동작이 되고, 언젠가 둘이
 * 한 화면에 섞여도(4인은 간략 보기에서도 카드다) 서로 주고받을 수 있다.
 */
export const DRAG_TYPE = "application/x-loa-cell";

export interface DragSource {
  slotId: string;
  position: string;
}

export function writeDragSource(e: DragEvent<HTMLElement>, source: DragSource) {
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(source));
  e.dataTransfer.effectAllowed = "move";
}

/** 끌어온 것이 우리 칸이 아니면 null. 남의 드래그를 받아 터지지 않게 한다. */
export function readDragSource(e: DragEvent<HTMLElement>): DragSource | null {
  const raw = e.dataTransfer.getData(DRAG_TYPE);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as DragSource).slotId === "string" &&
      typeof (parsed as DragSource).position === "string"
    ) {
      return parsed as DragSource;
    }
  } catch {
    // 형식이 깨진 것은 그냥 무시한다. 드롭이 일어나지 않을 뿐이다.
  }
  return null;
}

/** 이동 액션에 넘길 폼 데이터. 카드와 표가 같은 필드 이름을 쓴다. */
export function moveForm(params: {
  slug: string;
  week: string;
  from: DragSource;
  to: DragSource;
}): FormData {
  const data = new FormData();
  data.set("slug", params.slug);
  data.set("week", params.week);
  data.set("fromSlotId", params.from.slotId);
  data.set("fromPosition", params.from.position);
  data.set("toSlotId", params.to.slotId);
  data.set("toPosition", params.to.position);
  return data;
}

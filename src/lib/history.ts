import "server-only";

import { positionLabel } from "./positions";
import { prisma } from "./prisma";

/**
 * 편집 이력.
 *
 * 이 앱은 누가 무엇을 해도 막지 않는다(CLAUDE.md 3.4). 남의 신청을 빼는 것도,
 * 남이 만든 슬롯을 내리는 것도 된다. 그래서 **막는 대신 남긴다.** 무엇이 어떻게
 * 바뀌었는지 한 줄로 읽히면 되돌리는 것도, 물어보는 것도 사람이 할 수 있다.
 *
 * 기록은 `ChangeLog` 한 표에 모인다. 편성 변경과 요일표 변경이 같은 줄에 섞이는 것이
 * 맞다. 사람은 "어제 저녁에 무슨 일이 있었나"를 시간순으로 보지 화면별로 보지 않는다.
 */
export interface HistoryEntry {
  id: string;
  /** 화면에 그대로 뿌릴 문장. 서버에서 만든다 */
  text: string;
  actorLabel: string | null;
  /** ISO 문자열. 클라이언트로 Date를 넘길 수 없다 */
  createdAt: string;
}

type Detail = Record<string, unknown>;

function str(detail: Detail, key: string): string {
  const value = detail[key];
  return typeof value === "string" ? value : "";
}

function seat(detail: Detail): string {
  const position = str(detail, "position");
  return position ? positionLabel(position) : "";
}

/** `{raid} {자리}` 처럼 붙인다. 없는 조각은 건너뛴다. */
function join(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * 기록 한 줄을 문장으로 만든다.
 *
 * 저장된 detail은 그때의 형식으로 굳어 있다. 필드가 비어도 문장이 깨지지 않게
 * 조각을 붙이는 방식으로 만든다.
 */
function describe(action: string, detail: Detail): string {
  const raid = str(detail, "raid");
  const character = str(detail, "character");

  switch (action) {
    case "assign":
      return `${join(raid, seat(detail))}에 ${character} 배치`;
    case "unassign":
      return `${join(raid, seat(detail))}에서 ${character} 제외`;
    case "move":
    case "swap": {
      const from = (detail.from ?? {}) as Detail;
      const to = (detail.to ?? {}) as Detail;
      const arrow = `${join(str(from, "raid"), seat(from))} → ${join(str(to, "raid"), seat(to))}`;
      return action === "swap"
        ? `${character} 자리 맞바꿈 (${arrow})`
        : `${character} 이동 (${arrow})`;
    }
    case "pin":
      return `${join(raid, seat(detail))} 자리 ${detail.pinned ? "고정" : "고정 해제"}`;
    case "slot_create":
      return `요일표에 ${raid} 추가`;
    case "slot_update":
      return `요일표의 ${raid} 수정`;
    case "slot_archive":
      return `요일표에서 ${raid} 내림`;
    case "slot_keep":
      return `${raid} 전원 고정 ${detail.keepRoster ? "켬" : "끔"}`;
    default:
      // 옛 기록이나 아직 문장을 안 만든 동작. 무엇인지는 알 수 있게 둔다.
      return join(action, raid, character);
  }
}

export async function listHistory(instanceId: string, limit = 200): Promise<HistoryEntry[]> {
  const rows = await prisma.changeLog.findMany({
    where: { instanceId },
    select: { id: true, action: true, detail: true, actorLabel: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    text: describe(row.action, (row.detail ?? {}) as Detail),
    actorLabel: row.actorLabel,
    createdAt: row.createdAt.toISOString(),
  }));
}

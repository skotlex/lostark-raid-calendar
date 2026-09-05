import "server-only";

import type { Prisma } from "@/generated/prisma/client";

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
/**
 * 기록 한 줄을 남긴다. **바꾸는 코드는 모두 이걸 부른다.**
 *
 * 여기저기서 prisma.changeLog.create를 직접 부르면 어떤 동작이 남고 어떤 동작이
 * 빠졌는지 세어보기 어렵다. 실제로 캐릭터 삭제가 그렇게 빠져 있었다.
 */
export async function logEvent(params: {
  instanceId: string;
  action: string;
  actorLabel?: string | null;
  slotId?: string | null;
  weekStart?: Date | null;
  detail: Prisma.InputJsonObject;
}): Promise<void> {
  await prisma.changeLog.create({
    data: {
      instanceId: params.instanceId,
      action: params.action,
      actorLabel: params.actorLabel ?? null,
      slotId: params.slotId ?? null,
      weekStart: params.weekStart ?? null,
      detail: params.detail,
    },
  });
}

/**
 * 사람이 아니라 앱이 남긴 줄의 이름.
 *
 * 주간 초기화처럼 아무도 누르지 않았는데 편성이 바뀌는 일이 있다. 그런 줄을
 * actorLabel 없이 두면 화면이 "누군가"로 적어, 길드원 중 하나가 한 일처럼 읽힌다.
 */
export const SYSTEM_ACTOR = "시스템";

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
    case "character_add": {
      const count = typeof detail.count === "number" ? detail.count : 1;
      return count > 1 ? `캐릭터 ${count}명 등록 (${character})` : `캐릭터 ${character} 등록`;
    }
    case "member_claim":
      return `원정대 묶음 (대표 ${str(detail, "searched")}, 캐릭터 ${detail.total}명)`;
    case "week_reset": {
      const carried = typeof detail.carried === "number" ? detail.carried : 0;
      const head = join("주간 초기화", str(detail, "group"), str(detail, "week"));
      // 승계가 없으면 굳이 "0자리"라고 적지 않는다. 비었다는 것이 기본값이다.
      return carried > 0 ? `${head} · 고정 ${carried}자리 승계` : head;
    }
    case "character_delete":
      return `캐릭터 ${character} 삭제`;
    case "character_delete_many": {
      const who = str(detail, "member") || "소속 미지정";
      const names = str(detail, "characters");
      const head = `${who} 캐릭터 ${detail.count}개 삭제`;
      return names ? `${head} (${names})` : head;
    }
    default:
      // 옛 기록이나 아직 문장을 안 만든 동작. 무엇인지는 알 수 있게 둔다.
      return join(action, raid, character);
  }
}

/**
 * 한 쪽에 담는 줄 수.
 *
 * 기록은 지워지지 않고 쌓이기만 하므로 언제가 됐든 한 화면에 다 담기지 않는다.
 * 예전에는 최근 200줄만 잘라 보여줬는데, 그러면 그보다 오래된 일이 화면에서 아예
 * 사라져 "언제 누가 바꿨나"를 물어볼 길이 없었다. 자르는 대신 쪽으로 나눈다.
 */
export const HISTORY_PAGE_SIZE = 100;

export interface HistoryPage {
  entries: HistoryEntry[];
  /** 1부터. 범위를 벗어난 값을 받으면 안쪽으로 당겨서 돌려준다 */
  page: number;
  pageCount: number;
  total: number;
}

export async function listHistory(
  instanceId: string,
  page = 1,
  pageSize = HISTORY_PAGE_SIZE,
): Promise<HistoryPage> {
  const total = await prisma.changeLog.count({ where: { instanceId } });
  // 기록이 하나도 없어도 1쪽은 있다. 0쪽으로 두면 화면에 "1 / 0"이 찍힌다.
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // 주소에 손으로 친 숫자가 들어올 수 있다. 빈 쪽을 보여주는 대신 끝으로 당긴다.
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);

  const rows = await prisma.changeLog.findMany({
    where: { instanceId },
    select: { id: true, action: true, detail: true, actorLabel: true, createdAt: true },
    // createdAt만으로는 같은 시각에 들어온 줄들의 순서가 조회마다 달라질 수 있어,
    // 쪽을 넘길 때 같은 줄이 두 번 나오거나 한 줄이 통째로 빠진다. id로 한 번 더 가른다.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (current - 1) * pageSize,
    take: pageSize,
  });

  return {
    entries: rows.map((row) => ({
      id: row.id,
      text: describe(row.action, (row.detail ?? {}) as Detail),
      actorLabel: row.actorLabel,
      createdAt: row.createdAt.toISOString(),
    })),
    page: current,
    pageCount,
    total,
  };
}

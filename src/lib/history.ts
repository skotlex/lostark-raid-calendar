import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { type HistoryPeriod, periodRange } from "./historyPeriod";
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
 * describe가 문장을 만들 줄 아는 동작 전부.
 *
 * **위 switch에 case를 늘리면 여기에도 넣는다.** 검색이 이 목록을 훑어 "배치",
 * "고정" 같은 동작 이름을 action 값으로 되돌린다. 빠지면 그 동작만 이름으로
 * 찾을 수 없다(내용으로는 여전히 찾힌다).
 */
const ACTIONS = [
  "assign",
  "unassign",
  "move",
  "swap",
  "pin",
  "slot_create",
  "slot_update",
  "slot_archive",
  "slot_keep",
  "character_add",
  "member_claim",
  "character_delete",
  "character_delete_many",
  "week_reset",
] as const;

/**
 * 동작 이름으로 찾기.
 *
 * 저장된 것은 `assign` 같은 영문 코드인데 사람은 화면에 보이는 "배치"를 친다.
 * 그래서 빈 detail로 문장을 만들어 보고 거기에 친 말이 들어 있는 동작을 고른다.
 * 낱말표를 따로 두면 describe와 어긋나므로 describe에게 직접 물어본다.
 *
 * 참/거짓으로 문구가 갈리는 동작(고정/고정 해제)은 양쪽을 다 만들어 본다.
 * 그래서 "해제"를 치면 고정한 줄까지 함께 나온다 — **동작 이름 검색은 문구가
 * 아니라 동작을 고르는 것**이고, 그 편이 "고정"을 쳤을 때 반만 나오는 것보다 낫다.
 */
function actionsMatching(query: string): string[] {
  const both = { pinned: true, keepRoster: true } as Detail;
  return ACTIONS.filter(
    (action) =>
      describe(action, {}).includes(query) || describe(action, both).includes(query),
  );
}

/**
 * 시각 하나를 SQL에 넘길 값으로 바꾼다.
 *
 * `createdAt`이 timestamp **without time zone**이라 UTC 벽시계가 그대로 들어 있다.
 * 여기에 JS Date를 파라미터로 그냥 넘기면 드라이버가 실행 환경의 시간대를 붙인
 * 문자열로 보내고, 시간대 없는 칸과 비교되면서 그만큼 어긋난다(KST면 9시간).
 * 실제로 같은 조건이 37건과 253건으로 갈렸다. ISO 문자열을 timestamp로 못 박는다.
 */
function utcStamp(date: Date): Prisma.Sql {
  return Prisma.sql`${date.toISOString()}::timestamp`;
}

/** ILIKE에서 뜻을 갖는 글자. 사람이 친 그대로 찾게 막아둔다. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => "\\" + ch);
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

/**
 * 검색 조건.
 *
 * **detail을 통째로 문자열로 놓고 훑는다.** 캐릭터 이름, 레이드 이름, 자리, 앞으로
 * 늘어날 필드까지 규칙 하나로 걸린다. 필드마다 조건을 세우면 detail에 무언가
 * 추가될 때마다 검색에서 조용히 빠진다(난이도가 기록에서 빠져 있던 것과 같은 종류다).
 *
 * 저장된 detail은 그때의 형식으로 굳어 있어 필드 이름이 주차마다 다를 수 있다는
 * 점에서도 이 쪽이 안전하다.
 *
 * 대신 JSON의 키(`character`, `raid`)까지 훑는 대상에 든다. 키는 모두 영문이고
 * 사람이 찾는 것은 한글 이름이라 실제로 걸리는 일이 없어 그대로 둔다.
 *
 * 인덱스는 붙이지 않는다. 한 인스턴스의 기록은 주에 수백 줄이라 1년을 모아도
 * 수만 줄이고, 그 정도는 인스턴스로 좁힌 뒤 훑어도 밀리초 단위다. 실제로 느려지면
 * 그때 pg_trgm GIN을 얹는다(지금은 마이그레이션 파일 없이 db push로 운영한다).
 */
function searchFilter(
  instanceId: string,
  query: string,
  period: HistoryPeriod,
): Prisma.Sql {
  let where = Prisma.sql`"instanceId" = ${instanceId}`;

  const range = periodRange(period);
  if (range) {
    where = Prisma.sql`${where} AND "createdAt" >= ${utcStamp(range.from)}`;
    if (range.to) where = Prisma.sql`${where} AND "createdAt" < ${utcStamp(range.to)}`;
  }

  if (query) {
    const like = `%${escapeLike(query)}%`;
    const actions = actionsMatching(query);
    const byAction = actions.length
      ? Prisma.sql` OR action IN (${Prisma.join(actions)})`
      : Prisma.empty;
    where = Prisma.sql`${where} AND (detail::text ILIKE ${like} OR "actorLabel" ILIKE ${like}${byAction})`;
  }

  return where;
}

export async function listHistory(
  instanceId: string,
  options: {
    page?: number;
    query?: string;
    period?: HistoryPeriod;
    pageSize?: number;
  } = {},
): Promise<HistoryPage> {
  const pageSize = options.pageSize ?? HISTORY_PAGE_SIZE;
  // 앞뒤 공백은 사람이 친 흔적이지 찾는 말이 아니다.
  const query = (options.query ?? "").trim();
  const where = searchFilter(instanceId, query, options.period ?? "all");

  const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM "ChangeLog" WHERE ${where}
  `;
  const total = count;
  // 기록이 하나도 없어도 1쪽은 있다. 0쪽으로 두면 화면에 "1 / 0"이 찍힌다.
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // 주소에 손으로 친 숫자가 들어올 수 있다. 빈 쪽을 보여주는 대신 끝으로 당긴다.
  const current = Math.min(Math.max(1, Math.trunc(options.page ?? 1) || 1), pageCount);

  const rows = await prisma.$queryRaw<
    { id: string; action: string; detail: unknown; actorLabel: string | null; createdAt: Date }[]
  >`
    SELECT id, action, detail, "actorLabel", "createdAt"
    FROM "ChangeLog"
    WHERE ${where}
    -- createdAt만으로는 같은 시각에 들어온 줄들의 순서가 조회마다 달라질 수 있어,
    -- 쪽을 넘길 때 같은 줄이 두 번 나오거나 한 줄이 통째로 빠진다. id로 한 번 더 가른다.
    ORDER BY "createdAt" DESC, id DESC
    LIMIT ${pageSize} OFFSET ${(current - 1) * pageSize}
  `;

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

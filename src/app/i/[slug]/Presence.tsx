"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { positionLabel } from "@/lib/positions";
import { dayNameFull } from "@/lib/week";

/**
 * 같이 보고 있는 사람 — 발자국을 남기고 남의 발자국을 받아 화면에 세운다.
 *
 * 왜 폴링인지는 `src/lib/presence.ts`에 적어 뒀다. 여기서는 그 한 갈래로 **두 가지를
 * 함께** 해결한다.
 *
 *   1. 남이 저장하면 내 화면이 알아서 다시 그려진다 (편성표 버전 비교)
 *   2. 남이 어느 칸을 만지는 중인지 그 칸에 표식이 선다
 *
 * 왕복은 10초에 한 번뿐이다. 칸을 열고 닫는 순간에는 기다리지 않고 바로 한 번 더
 * 보낸다 — 표식이 늦게 뜨면 "지금 누가 만지는 중"이라는 말이 이미 거짓이 된다.
 */

/** 하트비트 간격. 편성표는 초를 다투는 화면이 아니라 이 정도면 충분하다. */
const POLL_MS = 10_000;

/** 표식 얼굴을 이만큼만 세우고 나머지는 숫자로 접는다. */
const FACE_LIMIT = 5;

export interface Viewer {
  id: string;
  label: string;
  avatarUrl: string | null;
  week: string;
  day: number;
  slotId: string | null;
  position: string | null;
}

/** 지금 손이 가 있는 칸. */
interface Focus {
  slotId: string;
  position: string;
}

interface PresenceValue {
  viewers: readonly Viewer[];
  /** "슬롯 자리" → 그 칸을 만지는 사람들. 보고 있는 주차가 같은 사람만이다. */
  atCell: ReadonlyMap<string, Viewer[]>;
  report: (focus: Focus | null) => void;
  /** 남이 무언가 바꿨는데 내가 입력 중이라 미뤄 둔 상태. */
  changed: boolean;
  apply: () => void;
  week: string;
  day: number;
}

const EMPTY_CELLS: ReadonlyMap<string, Viewer[]> = new Map();

/**
 * 기본값은 아무 일도 하지 않는다.
 *
 * 지난 주 화면은 고칠 수 없어 발자국을 남길 이유가 없다(page.tsx에서 provider를
 * 세우지 않는다). 칸 컴포넌트가 provider 유무를 따지지 않아도 되게 여기서 받아준다.
 */
const PresenceContext = createContext<PresenceValue>({
  viewers: [],
  atCell: EMPTY_CELLS,
  report: () => {},
  changed: false,
  apply: () => {},
  week: "",
  day: 0,
});

function cellKey(slotId: string, position: string): string {
  return `${slotId} ${position}`;
}

/**
 * 사람마다 다른 색.
 *
 * 둘이 동시에 다른 칸을 만질 때 표식이 모두 같은 색이면 어느 것이 누구인지 이름을
 * 읽어야 안다. 라이트·다크 어느 쪽 바탕에서도 글자가 묻히지 않는 중간 채도로 골랐다.
 */
const PRESENCE_COLORS = [
  "#c2593f",
  "#2f8f66",
  "#3d7cc0",
  "#9558bd",
  "#b5811f",
  "#2f9296",
] as const;

export function presenceColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    // 디스코드 ID는 숫자 문자열이라 앞자리가 거의 같다. 곱해 섞지 않으면
    // 같은 서버 사람끼리 색이 몰린다.
    hash = (hash * 31 + id.charCodeAt(i)) % 100_000;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

export function PresenceProvider({
  slug,
  week,
  day,
  children,
}: {
  slug: string;
  week: string;
  day: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [viewers, setViewers] = useState<readonly Viewer[]>([]);
  const [changed, setChanged] = useState(false);

  const focusRef = useRef<Focus | null>(null);
  /**
   * 마지막으로 **화면에 반영한** 편성표 버전.
   *
   * null은 아직 한 번도 받아본 적이 없다는 뜻이라 첫 응답을 기준선으로 삼고 넘어간다.
   * 서버가 첫 렌더에 실어 보내지 않는 이유는 그러자고 페이지 쿼리를 하나 더 늘리기
   * 때문이다. 어차피 화면이 열리자마자 한 번 보낸다.
   *
   * 미뤄 둘 때 이 값을 앞당기지 않는 것이 중요하다. 앞당기면 입력을 끝낸 뒤로도
   * "버전이 같다"고 보여 남의 변경이 영영 화면에 오지 않는다.
   */
  const versionRef = useRef<string | null>(null);
  /** 미뤄 둔 버전. `apply`가 이 값을 반영 완료로 옮긴다. */
  const pendingRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  /**
   * 마지막으로 받은 발자국을 글자로 굳힌 것.
   *
   * 응답은 매번 새 배열이라 그대로 넣으면 아무도 움직이지 않아도 10초마다 편성표
   * 전체가 다시 그려진다. 내용이 같으면 손대지 않는다.
   */
  const seenRef = useRef("");

  const send = useCallback(async () => {
    // 다른 탭을 보고 있으면 발자국도 필요 없고 화면을 다시 그릴 이유도 없다.
    // 돌아오는 순간 visibilitychange가 한 번 불러준다.
    if (document.visibilityState !== "visible") return;

    let data: { version?: unknown; viewers?: unknown } | null = null;
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          week,
          day,
          slotId: focusRef.current?.slotId ?? null,
          position: focusRef.current?.position ?? null,
        }),
      });
      if (!res.ok) return;
      data = (await res.json()) as { version?: unknown; viewers?: unknown };
    } catch {
      // 곁다리다. 끊겨도 화면은 지금 값 그대로 두고 다음 차례에 다시 해본다.
      return;
    }

    if (!aliveRef.current || typeof data.version !== "string") return;

    const next = Array.isArray(data.viewers) ? (data.viewers as Viewer[]) : [];
    const signature = next
      .map((v) => `${v.id}:${v.week}:${v.day}:${v.slotId}:${v.position}`)
      .join("|");
    if (signature !== seenRef.current) {
      seenRef.current = signature;
      setViewers(next);
    }

    if (versionRef.current === null) {
      versionRef.current = data.version;
      return;
    }
    if (data.version === versionRef.current) return;

    // 입력 중이면 미룬다. 치던 칸이 눈앞에서 바뀌면 무엇을 쓰고 있었는지 잃는다.
    if (focusRef.current) {
      pendingRef.current = data.version;
      setChanged(true);
      return;
    }

    versionRef.current = data.version;
    router.refresh();
  }, [slug, week, day, router]);

  useEffect(() => {
    aliveRef.current = true;
    void send();

    const timer = setInterval(() => void send(), POLL_MS);
    const onVisible = () => void send();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      aliveRef.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [send]);

  const report = useCallback(
    (next: Focus | null) => {
      const prev = focusRef.current;
      if (prev?.slotId === next?.slotId && prev?.position === next?.position) return;
      focusRef.current = next;
      // 기다리지 않고 바로 알린다. 표식은 늦으면 쓸모가 없다.
      void send();
    },
    [send],
  );

  const apply = useCallback(() => {
    versionRef.current = pendingRef.current ?? versionRef.current;
    pendingRef.current = null;
    setChanged(false);
    router.refresh();
  }, [router]);

  const atCell = useMemo(() => {
    const map = new Map<string, Viewer[]>();
    for (const viewer of viewers) {
      // 다른 주차를 보는 사람의 손을 이번 주 칸에 그리지 않는다. 슬롯은 주차와
      // 상관없이 같은 id라 이걸 빼면 지난 주를 열어 둔 사람이 이번 주 칸에 선다.
      if (!viewer.slotId || !viewer.position || viewer.week !== week) continue;
      const key = cellKey(viewer.slotId, viewer.position);
      const found = map.get(key);
      if (found) found.push(viewer);
      else map.set(key, [viewer]);
    }
    return map;
  }, [viewers, week]);

  const value = useMemo<PresenceValue>(
    () => ({ viewers, atCell, report, changed, apply, week, day }),
    [viewers, atCell, report, changed, apply, week, day],
  );

  return <PresenceContext value={value}>{children}</PresenceContext>;
}

/** 이 칸을 지금 만지고 있는 남들. */
export function useCellViewers(slotId: string, position: string): Viewer[] {
  const { atCell } = useContext(PresenceContext);
  return atCell.get(cellKey(slotId, position)) ?? [];
}

/**
 * 칸에 붙이는 포커스 알림.
 *
 * 칸 전체에 걸어 입력창뿐 아니라 고정·비우기 버튼에 손이 가도 표식이 선다.
 * 다음에 무엇을 누를지 모르는 상태라 그쪽도 "만지는 중"이 맞다.
 */
export function useFocusReport(slotId: string, position: string) {
  const { report } = useContext(PresenceContext);

  return useMemo(
    () => ({
      onFocusCapture: () => report({ slotId, position }),
      onBlurCapture: (event: FocusEvent<HTMLElement>) => {
        // 같은 칸 안에서 입력창→버튼으로 옮겨가는 것은 떠난 것이 아니다.
        if (event.currentTarget.contains(event.relatedTarget)) return;
        report(null);
      },
    }),
    [report, slotId, position],
  );
}

/**
 * 칸 위에 서는 표식.
 *
 * 칸 내용을 가린다. 클래스 칩은 표식이 사라지면 바로 다시 보이는 정보고, 지금 이
 * 칸에 남의 손이 올라와 있다는 사실은 그 몇 초 안에만 쓸모가 있다.
 */
export function CellPresence({ viewers }: { viewers: Viewer[] }) {
  if (viewers.length === 0) return null;

  const first = viewers[0];
  const rest = viewers.length - 1;

  return (
    <div
      className="cell-presence"
      style={{ background: presenceColor(first.id) }}
      title={`${viewers.map((v) => v.label).join(", ")} 님이 이 칸을 보고 있습니다`}
    >
      <span className="truncate">{first.label}</span>
      {rest > 0 && <span className="shrink-0">+{rest}</span>}
    </div>
  );
}

/**
 * 머리줄에 서는 접속자 목록과 "새 변경" 버튼.
 *
 * 얼굴만 늘어놓는다. 이름까지 적으면 요일 줄과 주차 이동이 있는 줄이 금세 넘친다.
 * 어느 요일을 보고 있는지는 짚어야 알 만한 것이라 제목으로 민다.
 */
export function PresenceBar() {
  const { viewers, changed, apply, week, day } = useContext(PresenceContext);

  const faces = viewers.slice(0, FACE_LIMIT);
  const hidden = viewers.length - faces.length;

  // 아무도 없고 미뤄 둔 것도 없으면 자리를 비운다. 빈 상자를 남기면 요일 줄의
  // 간격(gap)만 한 칸 벌어져 무엇이 빠졌는지 알 수 없는 틈이 생긴다.
  if (faces.length === 0 && !changed) return null;

  return (
    <div className="flex items-center gap-2 pb-1.5">
      {faces.length > 0 && (
        <div className="flex items-center">
          {faces.map((viewer) => (
            <Face key={viewer.id} viewer={viewer} week={week} day={day} />
          ))}
          {hidden > 0 && <span className="ml-1 text-xs text-text-faint">+{hidden}</span>}
        </div>
      )}

      {/*
        미뤄 둔 변경을 지금 반영하는 버튼.

        입력 중이 아니면 다음 차례(10초 안)에 알아서 반영되므로 이 버튼은 뜨지 않는다.
        기다리기 싫은 사람을 위한 자리다.
      */}
      {changed && (
        <button type="button" onClick={apply} className="presence-changed">
          새 변경 있음
        </button>
      )}
    </div>
  );
}

function Face({ viewer, week, day }: { viewer: Viewer; week: string; day: number }) {
  const where =
    viewer.week !== week
      ? "다른 주차"
      : viewer.slotId && viewer.position
        ? `${dayNameFull(viewer.day)} ${positionLabel(viewer.position)} 편집 중`
        : `${dayNameFull(viewer.day)}${viewer.day === day ? "" : " 보는 중"}`;

  return (
    <span
      className="presence-face"
      style={{ borderColor: presenceColor(viewer.id) }}
      title={`${viewer.label} — ${where}`}
    >
      {viewer.avatarUrl ? (
        // 20px짜리 얼굴이라 최적화를 거칠 이유가 없다. 머리줄의 Viewer도 같은 출처를
        // unoptimized로 쓴다(next.config.ts의 remotePatterns에 디스코드가 없다).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={viewer.avatarUrl} alt="" width={20} height={20} loading="lazy" />
      ) : (
        <span aria-hidden>{viewer.label.slice(0, 1)}</span>
      )}
    </span>
  );
}

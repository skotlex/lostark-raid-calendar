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
 * 칸을 열고 닫는 순간에는 다음 차례를 기다리지 않고 바로 한 번 더 보낸다 — 표식이
 * 늦게 뜨면 "지금 누가 만지는 중"이라는 말이 이미 거짓이 된다.
 */

/*
 * 간격은 **혼자냐 아니냐로 갈린다.**
 *
 * 편성표는 주 초 몇 분만 북적이고 나머지 시간에는 대개 혼자다. 한 값으로 고정하면
 * 둘 중 하나를 버려야 한다 — 빠르게 두면 아무도 없는 시간에 요청만 나가고, 느리게
 * 두면 정작 같이 짜는 순간이 굼뜨다.
 *
 * 응답에 접속자가 이미 들어 있어 따로 물어볼 필요가 없다. 붐빌 때만 빨라지므로
 * 요청 총량은 한 값으로 고정할 때보다 오히려 준다.
 */

/** 나 혼자일 때. 발자국을 남기는 것 말고는 할 일이 없다. */
const IDLE_MS = 15_000;

/** 남이 같이 보고 있을 때. 시트에 가까운 체감이 여기서 나온다. */
const BUSY_MS = 3_000;

/**
 * 이만큼 손을 놓고 있으면 아예 멈춘다.
 *
 * **Neon 무료 플랜이 세는 것은 쿼리 수가 아니라 컴퓨트가 깨어 있던 시간이다.**
 * 5분간 아무 활동이 없어야 잠들고(이 설정은 끄지도 늘리지도 못한다), 한 달에 깨어
 * 있어도 되는 시간이 400시간 — 하루 평균 13시간뿐이다.
 *
 * 우리 간격(3~15초)은 그 5분을 절대 못 넘긴다. 그러니 멈추는 장치가 없으면 **누구든
 * 탭을 열어둔 내내** DB가 깨어 있다. 사람 수에 비례하지도 않는다. 벽시계라서 한 명만
 * 아침에 켜고 밤에 닫아도 하루치를 다 쓴다.
 *
 * 편성표는 열어둔 채 자리를 비우는 것이 기본 사용 패턴이라 이 장치가 곧 한도를
 * 지키는 장치다. 손을 대는 순간 다시 돌아온다.
 */
const IDLE_STOP_MS = 2 * 60 * 1000;

/**
 * 손을 놓았다고 볼 신호.
 *
 * `pointermove`까지 듣는다. 편성표를 눌러보지 않고 읽기만 하는 시간이 짧지 않아,
 * 누름과 입력만 세면 읽는 중에 멈춰 버린다. 핸들러가 하는 일은 시각 하나를
 * 적는 것뿐이라 자주 불려도 부담이 없다.
 */
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

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
  /** 다음 차례까지의 간격. 응답을 받을 때마다 다시 정한다. */
  const delayRef = useRef(IDLE_MS);
  /** 마지막으로 손을 댄 시각. 화면이 열리는 것이 첫 활동이라 효과에서 채운다. */
  const lastActiveRef = useRef(0);
  /** 손을 놓아 멈춰 있는 상태인가. 다시 손을 대면 그 자리에서 깨운다. */
  const restingRef = useRef(false);

  const send = useCallback(async () => {
    // 다른 탭을 보고 있으면 발자국도 필요 없고 화면을 다시 그릴 이유도 없다.
    // 돌아오는 순간 visibilitychange가 한 번 불러준다.
    if (document.visibilityState !== "visible") return;

    /*
     * 열어만 두고 손을 놓았으면 멈춘다. Neon 컴퓨트가 잠들 수 있는 유일한 길이다.
     *
     * 내 발자국도 함께 끊긴다. 그게 맞다 — 자리를 뜬 사람이 남의 화면에 "보고 있는
     * 사람"으로 서 있으면 그 표시가 아무 뜻도 없어진다. 35초 뒤 조용히 사라진다.
     */
    if (Date.now() - lastActiveRef.current > IDLE_STOP_MS) {
      restingRef.current = true;
      return;
    }

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
    // 같은 값이라 화면을 손대지 않을 때도 간격은 갱신한다. 마지막 사람이 나간
    // 순간에도 발자국은 그대로라, 여기서 안 줄이면 혼자 남아 계속 빠르게 돈다.
    delayRef.current = next.length > 0 ? BUSY_MS : IDLE_MS;

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
    /*
     * setInterval이 아니라 한 번 끝날 때마다 다음을 잡는다.
     *
     * 간격이 도중에 바뀌므로 고정 주기로는 다음 차례를 옮길 수 없다. 응답이 늦을 때
     * 요청이 겹쳐 쌓이지 않는 것도 이쪽의 이득이다.
     */
    let alive = true;
    aliveRef.current = true;
    // 화면을 연 것 자체가 활동이다. 0인 채로 두면 첫 차례부터 멈춘 것으로 잡힌다.
    lastActiveRef.current = Date.now();
    restingRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    /*
     * 돌고 있는 줄은 언제나 하나다.
     *
     * 깨우는 쪽은 잡혀 있는 타이머를 지우지만, 이미 요청을 기다리는 중인 줄까지
     * 끊지는 못한다. 그 줄이 끝나면서 다음 차례를 또 잡으면 줄이 둘로 갈려 간격이
     * 반으로 준다. 번호를 붙여 옛 줄은 조용히 끝나게 한다.
     */
    let generation = 0;

    const loop = async (gen: number) => {
      await send();
      if (!alive || gen !== generation) return;
      timer = setTimeout(() => void loop(gen), delayRef.current);
    };
    void loop(generation);

    /*
     * 탭이 뒤로 가면 브라우저가 타이머를 1분 단위까지 늦춘다. 돌아오는 순간
     * **잡혀 있던 차례를 버리고 다시 시작한다.** 한 번 부르기만 하면 그다음 차례가
     * 최대 1분 뒤라, 돌아와서 한 번 반짝하고 다시 굼떠진다.
     */
    const wake = () => {
      generation += 1;
      clearTimeout(timer);
      void loop(generation);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      lastActiveRef.current = Date.now();
      restingRef.current = false;
      wake();
    };
    document.addEventListener("visibilitychange", onVisible);

    /*
     * 멈춰 있던 동안에는 남의 변경도 안 받았으므로 **손을 대는 순간 바로 한 번**
     * 돌린다. 다음 차례를 기다리면 돌아와서 몇 초 동안 옛 편성을 보게 된다.
     */
    const onActivity = () => {
      lastActiveRef.current = Date.now();
      if (!restingRef.current) return;
      restingRef.current = false;
      wake();
    };
    for (const name of ACTIVITY_EVENTS) {
      document.addEventListener(name, onActivity, { passive: true });
    }

    return () => {
      alive = false;
      aliveRef.current = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      for (const name of ACTIVITY_EVENTS) {
        document.removeEventListener(name, onActivity);
      }
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

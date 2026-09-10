"use client";

import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** 말풍선이 화면 가장자리에 남겨야 할 여백. */
const MARGIN = 8;

/** 저절로 닫히기까지. 닫는 법을 따로 알려주지 않아도 되고, 오래 떠 있으면 아래를 가린다. */
const CLOSE_MS = 3000;

/** 이만큼 누르고 있으면 꾹 누른 것으로 친다. */
const HOLD_MS = 450;

/**
 * 열려 있는 말풍선은 화면에 하나뿐이다.
 *
 * 여는 쪽이 나머지를 닫는다. 각자 자기 것만 보면 두 말풍선이 반 칸 어긋나 겹쳐 선다.
 */
const openBubbles = new Set<() => void>();

/**
 * 눌러서 여는 말풍선.
 *
 * **fixed다.** 표가 overflow 상자 안에 있어 칸에 붙여 그리면 잘리거나 없던 가로
 * 스크롤이 생긴다. 화면 기준으로 띄우면 그 상자를 벗어난다.
 *
 * 경고(CompactSlot의 WarnBadge)와 잘린 글자(useReveal)가 함께 쓴다. 둘 다 "칸 옆에
 * 잠깐 뜨는 쪽지"라 위치 보정·자동 닫기·서로 닫기가 똑같이 필요하다.
 */
export function useBubble() {
  /** 누른 것의 화면 좌표. null이면 닫혀 있다. */
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [left, setLeft] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // 화면 밖으로 나가면 안으로 민다. 표가 가로로 넓어 양끝 칸이 특히 위험하다.
  // 그리기 전에 옮겨야 말풍선이 한 번 튀지 않는다.
  useLayoutEffect(() => {
    const width = box.current?.offsetWidth;
    if (!anchor || !width) return;

    const half = width / 2;
    const min = MARGIN + half;
    const max = Math.max(window.innerWidth - MARGIN - half, min);
    setLeft(Math.min(Math.max(anchor.x, min), max));
  }, [anchor]);

  const close = useCallback(() => setAnchor(null), []);

  useEffect(() => {
    if (!anchor) return;

    // 열려 있는 동안만 목록에 든다. 닫힌 것을 남겨두면 여는 쪽이 아무 일도 하지
    // 않는 닫기를 매번 훑는다.
    openBubbles.add(close);
    const timer = setTimeout(close, CLOSE_MS);

    // 굴리면 바로 닫는다. 말풍선은 fixed라 화면이 움직여도 제자리에 남아, 가리키던
    // 글자는 이미 지나갔는데 쪽지만 따라다니는 꼴이 된다. 표 안쪽 스크롤도 잡아야
    // 하므로 캡처로 듣는다(scroll은 버블링하지 않는다).
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);

    return () => {
      openBubbles.delete(close);
      clearTimeout(timer);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor, close]);

  const open = useCallback((target: HTMLElement) => {
    for (const other of openBubbles) other();

    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    // 첫 그림도 가리키는 것 아래에서 시작한다. 0에서 시작하면 왼쪽 끝에서 미끄러져 온다.
    setLeft(x);
    setAnchor({ x, y: rect.bottom + 6 });
  }, []);

  const isOpen = anchor !== null;

  const toggle = useCallback(
    (target: HTMLElement) => {
      // 열려 있는데 또 누르면 닫는다. 3초를 기다리게 하지 않는다.
      if (anchor) close();
      else open(target);
    },
    [anchor, close, open],
  );

  /** 말풍선 자체. 여는 요소 옆에 그대로 둔다 — fixed라 어디에 있든 자리는 같다. */
  function render(content: ReactNode, tone?: "danger") {
    if (!anchor) return null;

    return (
      <div
        ref={box}
        role="status"
        className="tip-bubble"
        data-tone={tone}
        style={
          {
            left: left + "px",
            top: anchor.y + "px",
            // 꼬리는 말풍선이 밀린 만큼 되돌려 가리키던 곳을 계속 가리킨다.
            "--tail": anchor.x - left + "px",
          } as CSSProperties
        }
      >
        {content}
      </div>
    );
  }

  return { isOpen, open, close, toggle, render };
}

/** 이 요소나 그 안의 말줄임 칸이 실제로 잘려 있나. */
function clipped(el: HTMLElement): boolean {
  // 1px은 소수점 반올림 오차다. 이게 없으면 멀쩡한 글자가 잘린 것으로 잡힌다.
  if (el.scrollWidth > el.clientWidth + 1) return true;

  // 클래스 칸처럼 말줄임이 안쪽 칸에 걸린 경우. 바깥은 넘치지 않아 눈치채지 못한다.
  for (const child of el.querySelectorAll<HTMLElement>(".truncate")) {
    if (child.scrollWidth > child.clientWidth + 1) return true;
  }
  return false;
}

/**
 * 잘린 글자를 눌러서 펼친다.
 *
 * 좁은 화면에서는 칸이 한 뼘이라 긴 닉네임과 시너지가 말줄임으로 끊긴다. 줄을 접으면
 * 표가 두꺼워지고, 그대로 두면 터치에서는 끝까지 읽을 길이 아예 없다 — `title`은
 * 마우스를 얹어야 뜨는 것이라 손가락에는 없는 것과 같다.
 *
 * **잘렸을 때만 눌린다.** 폭이 남아 다 보이는 글자에까지 손 모양 커서가 서면 눌러도
 * 아무 일이 없는 자리가 화면에 널린다. 재는 것은 얹거나 누르는 순간이라, 넓은
 * 화면에서는 아무 일도 일어나지 않는다.
 *
 * `title`은 그대로 둔다. 마우스에는 이미 답하고 있던 방법이라 뺄 이유가 없다.
 *
 * @param trigger 탭이 이미 다른 일에 쓰이는 자리(표의 이름 칸 = 편집 열기)는 `hold`다.
 *   짧게 누르면 하던 일이 그대로 열리고, 꾹 누르면 글자가 뜬다.
 */
export function useReveal(text: string, trigger: "tap" | "hold" = "tap") {
  const bubble = useBubble();
  const [wide, setWide] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 방금 꾹 눌러 열었나. 뒤따라오는 클릭 한 번을 삼키는 데 쓴다 */
  const held = useRef(false);

  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  /** 커서 모양을 정하려고 미리 잰다. 손가락에는 hover가 없어 누를 때 다시 잰다. */
  function measure(e: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) {
    setWide(clipped(e.currentTarget));
  }

  const common = {
    title: text,
    onPointerEnter: measure,
    "data-reveal": "",
    "data-clipped": wide ? "" : undefined,
  };

  const props =
    trigger === "hold"
      ? {
          ...common,
          "data-hold": "",
          onPointerDown: (e: PointerEvent<HTMLElement>) => {
            held.current = false;
            /*
             * 마우스는 재지 않는다.
             *
             * 손가락에 길이 없어 만든 장치인데, 마우스에서까지 시간을 재면 천천히
             * 누른 클릭이 편집 대신 말풍선이 된다. 마우스에는 얹기만 해도 뜨는
             * 제목이 이미 있다.
             */
            if (e.pointerType === "mouse") return;

            // currentTarget은 핸들러가 끝나면 비므로 지금 붙잡아 둔다.
            const target = e.currentTarget;
            stop();
            timer.current = setTimeout(() => {
              if (!clipped(target)) return;
              held.current = true;
              setWide(true);
              bubble.open(target);
            }, HOLD_MS);
          },
          onPointerUp: stop,
          onPointerLeave: stop,
          onPointerCancel: stop,
          // 꾹 누르면 브라우저가 제 메뉴를 띄운다. 그 자리를 말풍선이 쓴다.
          onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
        }
      : {
          ...common,
          onClick: (e: MouseEvent<HTMLElement>) => {
            const target = e.currentTarget;
            if (bubble.isOpen) {
              bubble.close();
              return;
            }
            const on = clipped(target);
            setWide(on);
            if (on) bubble.open(target);
          },
        };

  /**
   * 꾹 눌러 펼친 뒤에는 클릭이 한 번 따라온다. 그대로 두면 글자를 읽으려 눌렀는데
   * 편집까지 열린다. 원래 하던 일을 이걸로 감싼다.
   */
  function guard<E>(fn: (e: E) => void) {
    return (e: E) => {
      if (held.current) {
        held.current = false;
        return;
      }
      fn(e);
    };
  }

  return { props, guard, bubble: bubble.render(text) };
}

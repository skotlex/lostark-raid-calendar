"use client";

import Image from "next/image";
import { useState } from "react";

import { classColor } from "@/lib/classColors";

/**
 * 캐릭터 초상.
 *
 * 전신 렌더를 칸 배경에 깔면 두 가지가 문제였다.
 *   1. 좁은 칸에 전신을 맞추느라 인물이 알아볼 수 없을 만큼 작아진다
 *   2. 이미지의 어두운 배경이 카드 바탕과 부딪혀 경계가 날카롭게 잘린다
 *
 * 그래서 배경으로 깔지 않고 **증명사진처럼 머리부터 상체까지 잘라낸 썸네일**로 둔다.
 * 확대와 기준점은 로아 렌더가 인물을 가운데 위쪽에 두는 것에 맞췄다.
 * 모서리를 둥글리고 테두리를 줘서 잘린 경계가 의도된 것으로 읽히게 한다.
 */

const SIZES = {
  sm: { box: "h-16 w-[3.25rem]", px: "52px" },
  md: { box: "h-20 w-16", px: "64px" },
} as const;

export function Portrait({
  src,
  className,
  size = "sm",
}: {
  src: string | null;
  /** 클래스명. 이미지가 없을 때 색과 글자로 대신한다 */
  className: string | null;
  size?: keyof typeof SIZES;
}) {
  const [broken, setBroken] = useState(false);
  const spec = SIZES[size];
  const color = classColor(className);

  if (!src || broken) {
    return (
      <div
        className={`${spec.box} flex shrink-0 items-center justify-center overflow-hidden rounded border border-border text-xs font-medium text-white/80`}
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {className?.slice(0, 2) ?? "?"}
      </div>
    );
  }

  return (
    <div
      className={`${spec.box} relative shrink-0 overflow-hidden rounded border border-border`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={spec.px}
        className="object-cover"
        // 원본은 대략 머리부터 허벅지까지 담겨 있다. 위쪽 15% 지점을 기준으로
        // 2.4배 확대하면 머리부터 상체 중간까지가 남는다.
        style={{ transform: "scale(2.4)", transformOrigin: "50% 15%" }}
        onError={() => setBroken(true)}
      />
    </div>
  );
}

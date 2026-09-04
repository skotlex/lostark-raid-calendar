"use client";

import Image from "next/image";
import { useState } from "react";

import { classColor } from "@/lib/classColors";

/**
 * 캐릭터 초상 — 증명사진 크기로 잘라낸 썸네일.
 *
 * 로아가 주는 `CharacterImage`는 **612×708 전신 렌더**다(여러 캐릭터로 확인).
 * 인물이 늘 같은 자리에 서 있어서 잘라낼 영역을 비율로 고정할 수 있다.
 *
 * 실제 이미지를 잘라 확인한 결과 머리부터 상체 중간까지는 다음 구간이다.
 *   가로 34% ~ 66%   (인물이 가운데 정렬돼 있다)
 *   세로 8.5% ~ 42.4% (머리 꼭대기가 12% 근처)
 *
 * `object-cover`로는 이만큼 확대되지 않는다. cover는 "칸을 덮는" 최소 배율까지만
 * 키우기 때문이다. 그래서 이미지를 칸보다 크게 늘려 놓고 위치를 밀어 원하는 구간만
 * 보이게 한다.
 */

/** 잘라낼 구간. 이미지 크기와 무관한 비율이라 해상도가 바뀌어도 유지된다. */
const CROP = { x: 0.34, y: 0.085, w: 0.32, h: 0.339 };

/** 늘릴 배율과 밀어낼 거리. 칸 크기에 대한 비율이라 크기가 달라져도 같은 구도가 나온다. */
const IMAGE_STYLE = {
  width: `${(1 / CROP.w) * 100}%`,
  height: "auto",
  left: `${-(CROP.x / CROP.w) * 100}%`,
  top: `${-(CROP.y / CROP.h) * 100}%`,
} as const;

const SIZES = {
  sm: { box: "w-[3.25rem]", px: "52px" },
  md: { box: "w-16", px: "64px" },
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

  // 칸 비율을 잘라낼 구간의 비율과 맞춰야 인물이 찌그러지지 않는다.
  const box = `${spec.box} aspect-[49/60] shrink-0 overflow-hidden rounded border border-border`;

  if (!src || broken) {
    return (
      <div
        className={`${box} flex items-center justify-center text-xs font-medium text-white/80`}
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {className?.slice(0, 2) ?? "?"}
      </div>
    );
  }

  return (
    <div className={`${box} relative`} style={{ backgroundColor: color }} aria-hidden>
      <Image
        src={src}
        alt=""
        width={612}
        height={708}
        sizes={spec.px}
        // Tailwind가 img에 max-width:100%를 걸어두므로 풀어야 확대가 먹는다.
        className="absolute max-w-none"
        style={IMAGE_STYLE}
        onError={() => setBroken(true)}
      />
    </div>
  );
}

/**
 * 편성 칸의 오른쪽에 걸치는 초상.
 *
 * 위의 증명사진형 썸네일과 달리 **카드 오른쪽 끝까지 붙어 배경처럼 깔린다.**
 * 전적 사이트 카드가 이 형태다. 다만 그냥 깔면 이미지의 사각형 경계와 어두운 배경이
 * 카드와 부딪히므로 두 가지를 건다.
 *
 *   1. 왼쪽으로 갈수록 투명해지는 마스크 — 글자와 만나는 쪽이 서서히 사라진다
 *   2. 클래스 색 글로우 — 인물 뒤에서 은은하게 퍼져 잘린 티가 덜 난다
 *
 * 칸 높이가 내용에 따라 달라지므로 여기서는 위 썸네일의 비율 계산을 쓰지 않는다.
 * 비율이 어긋나면 인물이 위아래로 밀리기 때문이다. 대신 `object-cover`로 칸을 채운 뒤
 * 머리 근처를 원점으로 확대해, 칸이 어떤 높이여도 머리부터 상체까지가 들어오게 한다.
 */
/** 글자와 만나는 왼쪽을 지운다. 반복되면 칸 밖으로 새므로 no-repeat와 함께 쓴다. */
const BLEED_MASK = "linear-gradient(to right, transparent 0%, #000 62%)";
/** 확대 원점을 머리 근처에 두고 키운다. 머리 위 여백을 조금 남겨 답답하지 않게 한다. */
const BLEED_ORIGIN = "50% 14%";
const BLEED_SCALE = 2.1;

export function PortraitBleed({
  src,
  className,
}: {
  src: string | null;
  className: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const color = classColor(className);

  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 w-[46%] overflow-hidden select-none"
      style={{
        maskImage: BLEED_MASK,
        WebkitMaskImage: BLEED_MASK,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(60% 55% at 70% 30%, ${color}, transparent 75%)` }}
      />
      {src && !broken && (
        <Image
          src={src}
          alt=""
          fill
          sizes="120px"
          className="object-cover"
          style={{ objectPosition: BLEED_ORIGIN, transform: `scale(${BLEED_SCALE})`, transformOrigin: BLEED_ORIGIN }}
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

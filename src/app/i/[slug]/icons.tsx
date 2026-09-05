/**
 * 칸에서 쓰는 아이콘.
 *
 * 카드와 표가 같은 그림을 쓴다. 같은 동작에 다른 모양이 붙으면 보기를 바꿀 때마다
 * 무엇이 무엇인지 다시 찾게 된다.
 *
 * 아이콘 두 개가 나란히 서므로 같은 상자에 그린다. 압정만 그림으로 바꾸고 ✕는 글자로
 * 두었더니 세로로 어긋났다. 글자는 글꼴의 베이스라인을 따라가고 그림은 상자 가운데에
 * 놓여서, flex로 모아도 1~2px이 남는다.
 */
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "size-3.5",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function CloseIcon() {
  return (
    <svg {...ICON_PROPS} strokeWidth={2}>
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

/**
 * 자리 고정 압정.
 *
 * 이모지(📌)는 글꼴에 딸린 그림이라 OS마다 모양도 색도 다르고, 옆의 ✕과 크기·굵기가
 * 맞지 않는다. 직접 그리면 currentColor를 따라가므로 고정된 자리에서 금색으로 물든다.
 *
 * 11px 근처에서 읽혀야 해서 머리·몸통·바늘 세 획으로 줄였다. 꽂힌 상태는 몸통을 채워
 * 색만으로 구분하지 않게 한다. 색약이거나 화면이 밝을 때 색 하나로는 잘 안 보인다.
 */
export function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg {...ICON_PROPS} strokeWidth={1.7}>
      <path d="M9 4h6" />
      <path d="M10 4v5L7.3 13h9.4L14 9V4z" fill={pinned ? "currentColor" : "none"} />
      <path d="M12 13v7" />
    </svg>
  );
}

/**
 * 끄는 손잡이.
 *
 * 점 여섯 개는 "여기를 잡으면 끌린다"는 오래된 약속이라 설명이 필요 없다.
 * 화살표를 쓰면 방향키나 이동 버튼처럼 읽혀 누르려고 하게 된다.
 */
export function GripIcon() {
  return (
    <svg {...ICON_PROPS} strokeWidth={0} fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

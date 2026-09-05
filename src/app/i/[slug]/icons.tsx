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

/**
 * 탭 아이콘.
 *
 * 글자만 늘어놓으면 다섯 탭이 한 덩어리로 보인다. 그림이 앞에 서면 위치를 외우기 전에도
 * 눈이 먼저 찾는다. 칸 아이콘보다 한 치수 크게 그린다.
 */
const TAB_ICON = { ...ICON_PROPS, className: "size-4 shrink-0" } as const;

/** 편성표. 자리 여덟 개가 격자로 늘어선 모양. */
export function BoardIcon() {
  return (
    <svg {...TAB_ICON} strokeWidth={1.6}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M9 10v10" />
      <path d="M15 10v10" />
    </svg>
  );
}

/** 요일표 편집. 목록에 연필. */
export function ScheduleIcon() {
  return (
    <svg {...TAB_ICON} strokeWidth={1.6}>
      <path d="M4 6h10" />
      <path d="M4 12h7" />
      <path d="M4 18h5" />
      <path d="M14.5 19.5 20 14l1.8 1.8-5.5 5.5-2.4.6z" />
    </svg>
  );
}

/** 캐릭터 관리. 사람 둘. */
export function MembersIcon() {
  return (
    <svg {...TAB_ICON} strokeWidth={1.6}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M17.5 14.2a5.5 5.5 0 0 1 3 4.8" />
    </svg>
  );
}

/** 편집 이력. 시곗바늘이 거꾸로 도는 모양. */
export function HistoryIcon() {
  return (
    <svg {...TAB_ICON} strokeWidth={1.6}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V10h5.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

/** 숙제 관리. 목록에 체크 표시. */
export function HomeworkIcon() {
  return (
    <svg {...TAB_ICON} strokeWidth={1.6}>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8.5h8" />
      <path d="M8 12.5h5" />
      <path d="m8.5 16.5 1.6 1.6 3.4-3.4" />
    </svg>
  );
}

/** 고정 현황. 압정을 탭 크기로 다시 그린다. */
export function PinTabIcon() {
  return (
    <svg {...TAB_ICON} strokeWidth={1.6}>
      <path d="M9 4h6" />
      <path d="M10 4v5L7.3 13h9.4L14 9V4z" />
      <path d="M12 13v7" />
    </svg>
  );
}

/**
 * 스펙 두 값 앞에 서는 표시.
 *
 * `1791.66 · 8326.34`처럼 숫자만 나란히 두면 어느 쪽이 템레벨이고 어느 쪽이 전투력인지
 * 아는 사람만 안다. 자릿수가 비슷한 구간도 있어 크기로도 못 가른다. 라벨을 붙이면
 * 확실하지만 좁은 머리띠에서 글자 넷이 숫자보다 길어진다.
 *
 * 카드 머리띠는 직업색 위에 흰 글씨라 currentColor를 그대로 따라간다.
 */
const STAT_ICON = { ...ICON_PROPS, className: "size-3.5 shrink-0" } as const;

/** 아이템 레벨. 위로 겹친 갈매기 — 올라간 단계. */
export function ItemLevelIcon() {
  return (
    <svg {...STAT_ICON} strokeWidth={2}>
      <path d="m5 12 7-6.5 7 6.5" />
      <path d="m5 19 7-6.5 7 6.5" />
    </svg>
  );
}

/**
 * 전투력. 엇갈린 검 두 자루.
 *
 * 한 자루로는 무기 아이콘이지 싸움이 아니다. 엇갈린 X는 전투를 뜻하는 오래된 기호라
 * 옆의 갈매기(아이템 레벨)와 실루엣이 겹치지 않는다.
 *
 * 비스듬히 누운 윤곽선으로 먼저 그렸더니 연필로 보였다. 작은 크기에서는 기울어진
 * 가는 선이 날인지 심인지 구분이 안 된다. 그래서 속을 채운다. 면으로 그리면 폭 차이가
 * 남아 뾰족한 날 · 넓은 코등이 · 가는 자루 셋이 작아도 구분된다.
 *
 * 검 하나를 세워 그리고 ±45°로 두 번 놓는다. 회전 중심을 날 한가운데(12,12)에 두어야
 * 칼끝 둘이 위로, 손잡이 둘이 아래로 벌어진 X가 된다. 손잡이 쪽에서 겹치면 칼끝만
 * 벌어진 V가 되어 검으로 안 읽힌다.
 *
 * 갈매기보다 한 치수 크다(16px). X는 대각선이라 같은 상자에서 작아 보이고, 코등이가
 * 14px에서는 날에 붙어 뭉갠다.
 */
const SWORD = (
  <>
    {/* 날. 위로 갈수록 좁아져 끝이 뾰족하다 */}
    <path d="M12 .6 13.5 3.8V15.4h-3V3.8z" />
    {/* 코등이. 날보다 넉넉히 넓어야 검으로 읽힌다 */}
    <path d="M8.2 15.5h7.6v1.9H8.2z" />
    {/* 자루와 손잡이 끝 */}
    <path d="M11 17.4h2v3.1h-2z" />
    <path d="M9.6 20.4h4.8v1.8H9.6z" />
  </>
);

export function CombatPowerIcon() {
  return (
    <svg {...STAT_ICON} className="size-4 shrink-0" strokeWidth={0} fill="currentColor">
      <g transform="rotate(45 12 12)">{SWORD}</g>
      <g transform="rotate(-45 12 12)">{SWORD}</g>
    </svg>
  );
}

/**
 * 주간 골드를 받는 캐릭터 표시.
 *
 * 원정대 하나에서 여섯뿐이라(goldEarners.ts) 나머지는 레이드를 가도 골드가 0이다.
 * 숙제 카드에서 그 둘을 가려야 합계를 읽을 수 있다.
 *
 * 게임 안의 골드 아이콘을 옮겨 그린다. 저울이 새겨진 금화가 쌓인 그림이라 처음 보는
 * 사람도 설명 없이 "골드"로 읽는다. 게임 이미지를 가져다 붙이지 않는 이유는 둘이다 —
 * 비트맵은 확대하면 뭉개지고, 게임 리소스를 저장소에 넣으면 남의 것을 담게 된다.
 *
 * 색은 금색으로 박는다. 다른 아이콘처럼 currentColor를 따라가면 카드 머리띠의
 * 직업색을 입어 금화로 보이지 않는다. 대신 못 받는 캐릭터는 currentColor 윤곽선으로
 * 두어 두 상태가 색이 아니라 그림으로 갈린다. 색만 다르면 색약인 사람에게는 같은
 * 그림 둘이 된다.
 *
 * 다른 스펙 아이콘보다 한 치수 크다(18px). 저울이 14px에서는 뭉쳐서 얼룩이 된다.
 */
const COIN_ICON = { ...STAT_ICON, className: "size-4.5 shrink-0" } as const;
const COIN_EDGE = "#a8690a";

export function GoldIcon({ earning }: { earning: boolean }) {
  // 못 받는 캐릭터: 빈 동전에 사선을 그어 막힌 것을 보인다.
  if (!earning) {
    return (
      <svg {...COIN_ICON} strokeWidth={1.8}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m6.5 17.5 11-11" />
      </svg>
    );
  }

  return (
    <svg {...COIN_ICON} strokeWidth={0}>
      {/* 뒤에 쌓인 두 닢. 테두리를 둘러야 한 덩어리로 뭉치지 않는다 */}
      <circle cx="8.4" cy="11" r="6.4" fill={COIN_EDGE} />
      <circle cx="8.4" cy="8.2" r="6.4" fill="#dc9a12" stroke={COIN_EDGE} strokeWidth={1} />
      {/* 앞 동전. 안쪽 테두리 한 줄이 도드라진 면을 만든다 */}
      <circle cx="14.2" cy="14.2" r="8" fill="#f5c344" stroke={COIN_EDGE} strokeWidth={1.2} />
      <circle cx="14.2" cy="14.2" r="6.1" stroke="#d18f10" strokeWidth={0.9} />
      {/* 새겨진 저울. 접시를 대에서 떼어 놔야 작을 때 가로줄 하나로 붙지 않는다 */}
      <g fill={COIN_EDGE}>
        <rect x="9.9" y="10.4" width="8.6" height="1.25" rx="0.6" />
        <rect x="13.55" y="10.4" width="1.3" height="7.6" />
        <rect x="11.6" y="17" width="5.2" height="1.3" rx="0.6" />
        <path d="M9.8 12.7h3.7L11.65 15z" />
        <path d="M14.9 12.7h3.7L16.75 15z" />
      </g>
    </svg>
  );
}

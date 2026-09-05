/**
 * 직업 문장(엠블럼) 아이콘.
 *
 * 파일은 `public/class-emblems/`에 함께 둔다. 처음에는 rloa.gg의 CDN을 가리켰는데,
 * **남의 서버가 우리 화면의 약한 고리가 된다.** 그쪽이 막히거나 주소를 바꾸면 우리 쪽이
 * 깨진다. 30개를 합쳐 330KB뿐이라 들고 있는 편이 싸다.
 *
 * 그림은 rloa.gg에서 받았다. 게임 자산이라 원본을 손대지 않고 그대로 둔다.
 *
 * **slug는 영문 직업명이 아니라 한글 직업명을 로마자로 옮긴 쪽에 가깝다.**
 * 워로드는 gunlancer가 아니라 warlord이고, 기공사는 soulfist가 아니라 soulmaster다.
 * 서른 개를 하나씩 눌러 확인했다. 새 직업이 나오면 같은 방식으로 확인해 추가한다.
 *
 * **새 직업 둘은 밑줄이 들어간다**(dragon_knight, dimension_master). 한 낱말로 붙여 쓴
 * 옛 직업들과 규칙이 다르니, 찾을 때 밑줄 형태도 함께 넣어본다.
 */
const EMBLEMS: Record<string, string> = {
  가디언나이트: "dragon_knight",
  차원술사: "dimension_master",

  버서커: "berserker",
  디스트로이어: "destroyer",
  워로드: "warlord",
  홀리나이트: "holyknight",
  슬레이어: "slayer",
  발키리: "valkyrie",

  배틀마스터: "battlemaster",
  인파이터: "infighter",
  기공사: "soulmaster",
  창술사: "lancemaster",
  스트라이커: "striker",
  브레이커: "breaker",

  데빌헌터: "devilhunter",
  블래스터: "blaster",
  호크아이: "hawkeye",
  스카우터: "scouter",
  건슬링어: "gunslinger",

  아르카나: "arcana",
  서머너: "summoner",
  바드: "bard",
  소서리스: "magician",

  블레이드: "blade",
  데모닉: "demonic",
  리퍼: "reaper",
  소울이터: "souleater",

  도화가: "artist",
  기상술사: "aeromancer",
  환수사: "wildsoul",
};

const BASE = "/class-emblems";

/** 표에 없는 직업이면 null. 화면은 아이콘 없이 그린다. */
export function classEmblem(className: string | null | undefined): string | null {
  const slug = EMBLEMS[className?.trim() ?? ""];
  return slug ? `${BASE}/${slug}.svg` : null;
}

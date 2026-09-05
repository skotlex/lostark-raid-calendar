/**
 * 직업 문장(엠블럼) 아이콘.
 *
 * rloa.gg의 CDN을 그대로 가리킨다(`cdn.rloa.gg/icons/class-emblems/<slug>.svg`).
 * 게임 자산이라 저장소에 복사해 두지 않고 링크만 건다. 그쪽이 막히거나 사라지면
 * 아이콘만 빠지고 화면은 그대로 돈다(`classEmblem`이 null을 주면 화면이 색 원으로 대신).
 *
 * **slug는 영문 직업명이 아니라 한글 직업명을 로마자로 옮긴 쪽에 가깝다.**
 * 워로드는 gunlancer가 아니라 warlord이고, 기공사는 soulfist가 아니라 soulmaster다.
 * 서른 개를 하나씩 눌러 확인했다. 새 직업이 나오면 같은 방식으로 확인해 추가한다.
 *
 * 가디언나이트와 차원술사는 아직 그 CDN에 없다. 이름을 여럿 넣어봤지만 전부 404였다.
 * 올라오면 여기에 한 줄 더한다.
 */
const EMBLEMS: Record<string, string> = {
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

const BASE = "https://cdn.rloa.gg/icons/class-emblems";

/** 표에 없는 직업이면 null. 화면은 아이콘 없이 그린다. */
export function classEmblem(className: string | null | undefined): string | null {
  const slug = EMBLEMS[className?.trim() ?? ""];
  return slug ? `${BASE}/${slug}.svg` : null;
}

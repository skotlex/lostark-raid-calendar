import "server-only";

import { DiscordError, botToken, fetchGuildMemberByBot } from "./discord";

/**
 * 아직도 길드원인가.
 *
 * **멤버십을 로그인 때 한 번만 보면 안 된다.** 세션 쿠키는 30일짜리라, 그것만 믿으면
 * 길드를 나간 사람이 한 달 내내 들어온다. CLAUDE.md 4장이 "길드 탈퇴 → 자동으로
 * 차단"이라고 적어둔 것이 실제로 그렇게 되게 하는 자리다.
 *
 * **매 요청마다 묻지는 않는다.** 편성표는 `force-dynamic`이라 메뉴를 누를 때마다 서버
 * 렌더가 돌고, 거기에 디스코드 왕복을 하나씩 붙이면 클릭마다 수십 ms가 더 붙는다.
 * 그래서 확인한 결과를 사람별로 잠시 들고 있는다.
 *
 * **캐시를 쿠키가 아니라 메모리에 두는 이유**는 서버 컴포넌트가 쿠키를 다시 구울 수
 * 없기 때문이다(Next 제약). 쿠키에 "마지막 확인 시각"을 박으려면 페이지를 라우트
 * 핸들러로 한 번 튕겼다 와야 하는데, 그러면 보고 있던 경로와 쿼리를 잃는다.
 * 메모리에 두면 페이지·서버 액션·라우트가 이 함수 하나를 그대로 부른다.
 *
 * 인스턴스마다 따로 들고 있어 실제 확인 횟수는 이 값보다 잦지만, 길드원 열 명
 * 남짓이라 어차피 시간당 몇 번이다. 디스코드 한도(초당 50회)와는 무관하다.
 */

/** 확인한 결과를 들고 있는 시간. 길드를 나가면 최대 이만큼 늦게 막힌다. */
const OK_TTL_MS = 60 * 60 * 1000;

/**
 * 디스코드가 답을 못 줬을 때 다시 묻기까지. 짧게 잡는다.
 *
 * 이 경우 **통과시킨다.** 디스코드가 잠깐 맛이 갔다고 길드원을 편성표에서 내쫓는
 * 것은 고치려던 문제보다 나쁘다. §3.4의 "경고는 차단하지 않는다"와 같은 태도다.
 */
const ERROR_TTL_MS = 5 * 60 * 1000;

/** 디스코드 ID → 이때까지는 다시 묻지 않는다(epoch ms). */
const checkedUntil = new Map<string, number>();

/**
 * 길드에 남아 있으면 true. **false는 "확실히 나갔다"일 때만 준다.**
 *
 * 못 읽은 경우를 false로 뭉뚱그리면 디스코드 장애가 곧 전원 차단이 된다.
 */
export async function isStillGuildMember(discordUserId: string): Promise<boolean> {
  const until = checkedUntil.get(discordUserId);
  if (until !== undefined && until > Date.now()) return true;

  // 봇 토큰이 없으면 재검사 수단 자체가 없다. 로그인 때의 판정만 남는다.
  if (!botToken()) {
    checkedUntil.set(discordUserId, Date.now() + OK_TTL_MS);
    return true;
  }

  try {
    const member = await fetchGuildMemberByBot(discordUserId);
    if (!member) {
      // 다시 들어오면 로그인부터 하므로 남겨둘 것이 없다.
      checkedUntil.delete(discordUserId);
      return false;
    }
    checkedUntil.set(discordUserId, Date.now() + OK_TTL_MS);
    return true;
  } catch (error) {
    // 설정이 틀린 경우(봇 미초대, 길드 ID 오타)도 여기로 온다. 조용히 넘기면
    // 재검사가 도는 줄 알고 있는데 실은 아무것도 안 하는 상태가 되므로 남긴다.
    console.error(
      "[guildAccess] 멤버십 재검사 실패:",
      error instanceof DiscordError ? error.message : error,
    );
    checkedUntil.set(discordUserId, Date.now() + ERROR_TTL_MS);
    return true;
  }
}

/**
 * 방금 확인한 결과를 넣어 둔다. 로그인 콜백이 부른다.
 *
 * 거기서는 사용자 토큰으로 이미 멤버십을 확인한 참이라, 이걸 넣지 않으면 로그인
 * 직후 첫 페이지에서 봇으로 같은 것을 한 번 더 묻는다.
 */
export function rememberGuildMember(discordUserId: string): void {
  checkedUntil.set(discordUserId, Date.now() + OK_TTL_MS);
}

/** 테스트용. 모듈 수준 캐시라 케이스 사이에 비워야 한다. */
export function __clearGuildAccessCache(): void {
  checkedUntil.clear();
}

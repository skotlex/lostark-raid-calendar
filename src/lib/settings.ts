import "server-only";

import { prisma } from "./prisma";

/**
 * 사람별 화면 설정.
 *
 * **쿠키가 앞에 서고 DB가 뒤를 받친다.**
 *
 * 쿠키만 두면 PC에서 다크로 바꿔도 폰은 그대로다. DB만 두면 화면을 그릴 때마다
 * 조회가 붙고, 로그인 전(로그인 화면)에는 읽을 사람이 없어 결국 쿠키가 또 필요하다.
 *
 * 그래서 이렇게 나눈다.
 *   - 화면은 언제나 쿠키를 읽는다. 서버 렌더에 추가 조회가 없고 깜빡임도 없다.
 *   - 바꾸는 순간 쿠키를 쓰고, 같은 값을 DB에도 적어 둔다.
 *   - **로그인할 때 DB 값을 쿠키에 부어 준다.** 기기가 바뀌어도 이때 따라온다.
 *
 * 저장에 실패해도 화면은 이미 바뀌어 있다. 다음 로그인에서 옛 값이 돌아올 뿐이라
 * 실패를 사용자에게 알리지 않는다.
 */
export interface UserSettings {
  theme: string | null;
  boardView: string | null;
}

export async function readSettings(discordUserId: string): Promise<UserSettings | null> {
  return prisma.userSetting.findUnique({
    where: { discordUserId },
    select: { theme: true, boardView: true },
  });
}

export async function saveSettings(
  discordUserId: string,
  patch: Partial<UserSettings>,
): Promise<void> {
  await prisma.userSetting.upsert({
    where: { discordUserId },
    create: { discordUserId, ...patch },
    update: patch,
  });
}

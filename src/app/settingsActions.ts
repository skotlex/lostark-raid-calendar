"use server";

import { readSession } from "@/lib/session";
import { saveSettings } from "@/lib/settings";

import { toBoardView } from "./i/[slug]/view";
import { toThemeChoice } from "./theme";

/**
 * 화면 설정을 사람에게 붙여 저장한다.
 *
 * 화면은 이미 쿠키로 바뀌어 있다. 여기서는 다음 로그인 때 따라오도록 적어두기만 한다.
 * 그래서 실패해도 아무 말 하지 않는다(settings.ts 참조).
 *
 * 로그인하지 않은 사람은 조용히 지나간다. 저장할 대상이 없을 뿐 오류가 아니다.
 */
export async function saveThemeAction(value: string): Promise<void> {
  const session = await readSession();
  if (!session) return;

  const theme = toThemeChoice(value);
  await saveSettings(session.discordUserId, { theme: theme === "system" ? null : theme });
}

export async function saveBoardViewAction(value: string): Promise<void> {
  const session = await readSession();
  if (!session) return;

  await saveSettings(session.discordUserId, { boardView: toBoardView(value) });
}

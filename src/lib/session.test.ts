import { beforeAll, describe, expect, it } from "vitest";

import { decodeSession, encodeSession, type Session } from "./session";

/**
 * 세션 쿠키 서명.
 *
 * 위조를 막는 것이 이 코드의 전부라 눈으로는 검증할 수 없다. 서명이 깨진 값,
 * 만료된 값, 내용만 바꾼 값이 각각 거절되는지 확인한다.
 */

beforeAll(() => {
  process.env.INSTANCE_SESSION_SECRET = "테스트용-비밀키-실제-값이-아니다";
});

function make(overrides: Partial<Session> = {}): Session {
  return {
    discordUserId: "123456789012345678",
    label: "KafkaFelicia",
    avatarUrl: null,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

describe("세션 쿠키", () => {
  it("구웠다 읽으면 같은 값이 나온다", () => {
    const session = make();
    expect(decodeSession(encodeSession(session))).toEqual(session);
  });

  it("서명이 없거나 깨지면 거절한다", () => {
    const raw = encodeSession(make());
    const [body] = raw.split(".");

    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession(body)).toBeNull();
    expect(decodeSession(`${body}.깨진서명`)).toBeNull();
  });

  it("내용을 바꾸면 서명이 맞지 않는다", () => {
    // 남의 디스코드 ID로 바꿔치기하는 시나리오다. 이게 통과하면 신원이 무의미해진다.
    const raw = encodeSession(make());
    const signature = raw.slice(raw.lastIndexOf(".") + 1);
    const forged = Buffer.from(
      JSON.stringify(make({ discordUserId: "999999999999999999" })),
    ).toString("base64url");

    expect(decodeSession(`${forged}.${signature}`)).toBeNull();
  });

  it("만료된 세션은 서명이 맞아도 거절한다", () => {
    const expired = encodeSession(make({ exp: Math.floor(Date.now() / 1000) - 1 }));
    expect(decodeSession(expired)).toBeNull();
  });

  it("비밀키가 다르면 남이 구운 쿠키를 받지 않는다", () => {
    const raw = encodeSession(make());
    process.env.INSTANCE_SESSION_SECRET = "다른-비밀키";
    expect(decodeSession(raw)).toBeNull();
    process.env.INSTANCE_SESSION_SECRET = "테스트용-비밀키-실제-값이-아니다";
  });
});

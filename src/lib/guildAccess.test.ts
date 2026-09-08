import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __clearGuildAccessCache, guildProfile, isStillGuildMember } from "./guildAccess";

/**
 * 길드 멤버십 재검사.
 *
 * 여기서 잘못 답하면 결과가 양쪽 다 나쁘다. 나간 사람이 계속 들어오거나(고치려던
 * 문제 그대로), 멀쩡한 길드원이 통째로 쫓겨난다. 특히 **설정 실수와 실제 탈퇴가
 * 둘 다 404로 온다**는 것이 이 파일의 이유다.
 *
 * 재검사가 받아 오는 이름(`guildProfile`)도 여기서 본다. 못 받은 경우에 옛 이름을
 * 지워 버리면 쿠키의 더 낡은 이름으로 되돌아가므로 그쪽도 확인한다.
 */

const USER = "123456789012345678";

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/** 정상 멤버 응답. 실제 구조에서 읽는 자리만 남겼다. */
const MEMBER = { nick: "카프카", user: { id: USER, username: "kafka", avatar: null } };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __clearGuildAccessCache();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  process.env.DISCORD_BOT_TOKEN = "테스트용-봇-토큰";
  process.env.DISCORD_GUILD_ID = "999999999999999999";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // 실패 경로가 일부러 로그를 남긴다. 테스트 출력까지 더럽힐 이유는 없다.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("길드 멤버십 재검사", () => {
  it("길드에 있으면 통과시킨다", async () => {
    fetchMock.mockResolvedValue(reply(200, MEMBER));
    await expect(isStillGuildMember(USER)).resolves.toBe(true);
  });

  it("한 번 확인하면 다시 묻지 않는다", async () => {
    fetchMock.mockResolvedValue(reply(200, MEMBER));

    await isStillGuildMember(USER);
    await isStillGuildMember(USER);
    await isStillGuildMember(USER);

    // 클릭마다 디스코드에 묻지 않는 것이 이 캐시의 존재 이유다.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("길드를 나갔으면(10007) 막는다", async () => {
    fetchMock.mockResolvedValue(reply(404, { code: 10007 }));
    await expect(isStillGuildMember(USER)).resolves.toBe(false);
  });

  it("막은 결과는 캐시하지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(reply(404, { code: 10007 }));
    expect(await isStillGuildMember(USER)).toBe(false);

    // 다시 들어온 사람을 캐시 때문에 계속 막으면 안 된다.
    fetchMock.mockResolvedValueOnce(reply(200, MEMBER));
    expect(await isStillGuildMember(USER)).toBe(true);
  });

  it("봇이 길드에 없으면(10004) 길드원을 내쫓지 않는다", async () => {
    // 설정 실수 한 번으로 전원이 로그인 화면에 갇히는 것이 최악의 결과다.
    fetchMock.mockResolvedValue(reply(404, { code: 10004 }));
    await expect(isStillGuildMember(USER)).resolves.toBe(true);
  });

  it("디스코드가 답을 못 주면 통과시킨다", async () => {
    fetchMock.mockResolvedValue(reply(500, {}));
    await expect(isStillGuildMember(USER)).resolves.toBe(true);
  });

  it("연결 자체가 끊겨도 통과시킨다", async () => {
    fetchMock.mockRejectedValue(new Error("네트워크가 끊겼다"));
    await expect(isStillGuildMember(USER)).resolves.toBe(true);
  });

  it("봇 토큰이 없으면 묻지 않고 통과시킨다", async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    await expect(isStillGuildMember(USER)).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * 이름 따라가기.
 *
 * 세션 쿠키의 이름은 로그인 그 순간의 값이라 30일까지 옛 이름이 남는다. 재검사
 * 응답에 지금 닉네임이 이미 들어 있어, 그걸 들고 있다가 쿠키 값을 덮는다.
 */
describe("길드 프로필", () => {
  it("확인하기 전에는 아무것도 없다", () => {
    // null이면 부르는 쪽이 쿠키 값을 그대로 쓴다(session.ts).
    expect(guildProfile(USER)).toBeNull();
  });

  it("확인하면 지금 닉네임을 들고 있는다", async () => {
    fetchMock.mockResolvedValue(reply(200, MEMBER));
    await isStillGuildMember(USER);
    expect(guildProfile(USER)?.label).toBe("카프카");
  });

  it("닉을 바꾸면 다음 확인에서 새 이름이 된다", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, MEMBER));
    await isStillGuildMember(USER);

    // 캐시가 만료된 셈 치고 다시 묻게 한다. 실제로는 한 시간 뒤다.
    __clearGuildAccessCache();
    fetchMock.mockResolvedValueOnce(reply(200, { ...MEMBER, nick: "동네콩" }));
    await isStillGuildMember(USER);

    expect(guildProfile(USER)?.label).toBe("동네콩");
  });

  it("길드 닉이 없으면 표시 이름으로 떨어진다", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { nick: null, user: { id: USER, username: "kafka", global_name: "카프카펠리시아", avatar: null } }),
    );
    await isStillGuildMember(USER);
    expect(guildProfile(USER)?.label).toBe("카프카펠리시아");
  });

  it("디스코드가 답을 못 줘도 받아 뒀던 이름을 버리지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, MEMBER));
    await isStillGuildMember(USER);

    __clearGuildAccessCache();
    fetchMock.mockResolvedValueOnce(reply(200, { ...MEMBER, nick: "동네콩" }));
    await isStillGuildMember(USER);

    // 다음 확인이 실패해도 방금 받은 새 이름이 남아야 한다. 지우면 화면이 쿠키의
    // 더 낡은 이름으로 되돌아간다.
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    fetchMock.mockResolvedValueOnce(reply(500, {}));
    await isStillGuildMember(USER);

    expect(guildProfile(USER)?.label).toBe("동네콩");
  });

  it("봇 토큰이 없으면 이름도 없다", async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    await isStillGuildMember(USER);
    // 물어볼 길이 없다. 쿠키 값이 그대로 쓰이는 것이 맞다.
    expect(guildProfile(USER)).toBeNull();
  });

  it("길드를 나가면 이름도 지운다", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, MEMBER));
    await isStillGuildMember(USER);

    __clearGuildAccessCache();
    fetchMock.mockResolvedValueOnce(reply(404, { code: 10007 }));
    expect(await isStillGuildMember(USER)).toBe(false);

    expect(guildProfile(USER)).toBeNull();
  });
});

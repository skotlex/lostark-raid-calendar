import "server-only";

/**
 * 디스코드 OAuth2.
 *
 * 입장 자격은 **길드 멤버십**이다(CLAUDE.md 4장). 로그인했다는 것만으로는 부족하고
 * 우리 길드 서버에 실제로 들어와 있어야 한다. 그래서 `guilds.members.read`까지 받아
 * 해당 길드의 멤버 정보를 직접 읽는다. `guilds`(서버 목록)로 대신하지 않는다 —
 * 그쪽은 목록만 주고 길드 닉네임을 주지 않는다.
 *
 * 길드 닉네임이 필요한 이유는 그것이 곧 캐릭터명이기 때문이다.
 */

const API = "https://discord.com/api/v10";

/** 브라우저 번들로 새면 안 되는 값이라 이 파일을 통해서만 읽는다. */
function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}이 없다. .env.local을 확인한다`);
  return value;
}

export function clientId(): string {
  return env("DISCORD_CLIENT_ID");
}

export function guildId(): string {
  return env("DISCORD_GUILD_ID");
}

/** 콜백 주소. 개발과 배포가 다르므로 요청 origin에서 만든다. */
export function callbackUrl(origin: string): string {
  return `${origin}/api/auth/discord/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  // 동의 화면은 버전 없는 주소가 정식이다. /api/v10 쪽은 여기로 한 번 더 튕긴다.
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", callbackUrl(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds.members.read");
  url.searchParams.set("state", state);
  // 매번 동의 화면을 띄우지 않는다. 두 번째부터는 그대로 통과한다.
  url.searchParams.set("prompt", "none");
  return url.toString();
}

export async function exchangeCode(origin: string, code: string): Promise<string> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId()}:${env("DISCORD_CLIENT_SECRET")}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(origin),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    // 응답 본문에 코드가 섞여 있을 수 있어 그대로 흘리지 않는다.
    throw new DiscordError(`토큰 교환에 실패했다 (${res.status})`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new DiscordError("토큰이 오지 않았다");
  return body.access_token;
}

export interface GuildMember {
  discordUserId: string;
  /** 길드 닉네임 → 표시 이름 → 사용자명 순. 길드 닉네임이 캐릭터명이다. */
  label: string;
  avatarUrl: string | null;
}

/**
 * 길드 멤버 정보. **길드에 없으면 null이다.** 이것이 입장 판정이다.
 *
 * 디스코드는 비멤버에게 404를 준다. 다른 오류와 구분해야 "길드에 없다"와
 * "디스코드가 잠깐 맛이 갔다"를 같은 화면으로 보여주지 않는다.
 */
export async function fetchGuildMember(accessToken: string): Promise<GuildMember | null> {
  const res = await fetch(`${API}/users/@me/guilds/${guildId()}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new DiscordError(`길드 정보를 읽지 못했다 (${res.status})`);

  const body = (await res.json()) as {
    nick?: string | null;
    avatar?: string | null;
    user?: { id: string; username: string; global_name?: string | null; avatar?: string | null };
  };

  const user = body.user;
  if (!user?.id) throw new DiscordError("사용자 정보가 오지 않았다");

  return {
    discordUserId: user.id,
    label: body.nick || user.global_name || user.username,
    avatarUrl: avatarUrl(user.id, user.avatar ?? null),
  };
}

function avatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=64`;
}

export class DiscordError extends Error {}

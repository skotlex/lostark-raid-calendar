"use client";

import { useActionState, useEffect, useState } from "react";

import {
  type ImportState,
  type RegisterState,
  type SiblingsState,
  importSiblingsAction,
  previewSiblingsAction,
  registerAction,
} from "./actions";

const REGISTER_IDLE: RegisterState = { status: "idle", message: "" };
const SIBLINGS_IDLE: SiblingsState = {
  status: "idle",
  message: "",
  searched: "",
  siblings: [],
};
const IMPORT_IDLE: ImportState = { status: "idle", message: "", result: null };

/** 원정대에는 저렙 부캐가 잔뜩 섞여 있다. 기본 선택 기준선을 이 값으로 잡는다. */
const DEFAULT_MIN_LEVEL = 1730;

/**
 * 고를 수 있는 캐릭터인지.
 *
 * 아직 없는 캐릭터와, 등록은 됐지만 **소속이 빈** 캐릭터를 고를 수 있다. 뒤쪽은 남이
 * 편성 칸에 대신 넣어 만들어진 것들이라 여기서 집어야 주인과 원정대가 붙는다.
 * 이미 소속이 붙은 캐릭터는 잠근다. 여기서 소속을 갈아치우면 먼저 클레임한 사람의
 * 원정대에서 캐릭터가 조용히 빠져나간다.
 *
 * 타입은 서버 모듈(lib/characters)이 아니라 액션 결과에서 꺼낸다. `server-only`가
 * 붙어 있어 클라이언트 파일이 이름을 직접 들고 오면 안 된다.
 */
function canPick(sibling: SiblingsState["siblings"][number]): boolean {
  return !sibling.registered || sibling.unclaimed;
}

/**
 * 여기서 등록한 캐릭터는 **등록한 사람 소속이 된다.**
 *
 * 캐릭터 관리는 자기 캐릭터를 챙기는 화면이라 그렇게 본다. 남의 캐릭터를 대신 넣는 일은
 * 편성 칸에서 일어나고, 그 경로만 무소속으로 남긴다(lib/board.ts).
 *
 * 로아 API에는 캐릭터의 주인이 없다. 그래서 등록이 곧 "이건 내 것"이라는 신고다.
 * 여기서 한 번 불러두면 나중에 남이 편성 칸에 대신 넣어줘도 소속이 잡힌다
 * (lib/members.ts의 claimedNames).
 */
export function RegisterPanel({
  slug,
  mine,
  rosters,
}: {
  slug: string;
  mine: number;
  /** 내 원정대. 한 명씩 등록할 때 어디로 넣을지 고르는 데 쓴다. */
  rosters: { id: string; label: string }[];
}) {
  const [mode, setMode] = useState<"single" | "siblings">("siblings");

  return (
    <section className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <ModeButton active={mode === "siblings"} onClick={() => setMode("siblings")}>
          내 원정대 불러오기
        </ModeButton>
        <ModeButton active={mode === "single"} onClick={() => setMode("single")}>
          한 명씩 등록
        </ModeButton>

        <span className="ml-auto text-xs text-text-faint">
          {mine > 0 ? (
            <>
              내 캐릭터 <span className="tabular text-text-dim">{mine}</span>명
            </>
          ) : (
            "아직 내 캐릭터가 없습니다"
          )}
        </span>
      </div>

      <p className="mb-3 text-xs text-text-dim">
        여기서 등록한 캐릭터는 <strong className="text-text">내 캐릭터</strong>로 묶입니다.
        계정이 여러 개면 계정마다 한 번씩 불러와 주세요. 편성표 칸에 다른 분의 닉네임을
        넣는 것은 소속에 영향을 주지 않습니다.
      </p>

      {mode === "siblings" ? (
        <SiblingsForm slug={slug} />
      ) : (
        <SingleForm slug={slug} rosters={rosters} />
      )}
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-accent/15 text-accent"
          : "text-text-dim hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 한 명씩 등록.
 *
 * **어느 원정대인지는 사람이 고른다.** 캐릭터 하나만 받는 자리라 어느 계정 것인지 알
 * 방법이 없고, 로아 API에도 캐릭터를 계정에 잇는 값이 없다. 원정대를 물어보지 않으면
 * 여기서 넣은 캐릭터만 `원정대 미지정`에 쌓여, 골드 6명이 원정대 단위로 갈린다.
 *
 * 원정대를 아직 하나도 안 만들었으면 고를 것이 없으니 칸을 숨긴다. 원정대는 불러오기
 * 한 번이 하나씩 만든다(lib/members.ts).
 */
function SingleForm({
  slug,
  rosters,
}: {
  slug: string;
  rosters: { id: string; label: string }[];
}) {
  const [state, submit, pending] = useActionState(registerAction, REGISTER_IDLE);

  return (
    <form action={submit} className="flex flex-wrap items-end gap-2">
      <Field label="캐릭터 닉네임" className="w-48">
        <input
          name="name"
          required
          placeholder="정확한 닉네임"
          className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </Field>
      {rosters.length > 0 && (
        <Field label="원정대" className="w-40">
          <select
            name="roster"
            defaultValue={rosters[0].id}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
          >
            {rosters.map((roster) => (
              <option key={roster.id} value={roster.id}>
                {roster.label}
              </option>
            ))}
            <option value="">지정 안 함</option>
          </select>
        </Field>
      )}
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={pending}
        className="btn-inline rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "조회 중…" : "등록"}
      </button>
      <Feedback status={state.status} message={state.message} />
    </form>
  );
}

function SiblingsForm({ slug }: { slug: string }) {
  const [search, searchSubmit, searching] = useActionState(
    previewSiblingsAction,
    SIBLINGS_IDLE,
  );
  const [imported, importSubmit, importing] = useActionState(
    importSiblingsAction,
    IMPORT_IDLE,
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 조회 결과가 새로 오면 쓸 만한 것만 미리 골라 둔다. 목록은 이미 레벨 내림차순이다.
  // 25개를 전부 등록하면 API 요청도 그만큼 나가고 목록도 저렙 부캐로 덮인다.
  //
  // 소속이 빈 캐릭터도 함께 고른다. 불러오기를 누른 사람이 곧 주인이라 소속을 붙이는
  // 것이 이 화면의 목적이고, 손으로 다시 체크하게 하면 무엇을 눌러야 하는지 알 수 없다.
  useEffect(() => {
    if (search.status !== "ok") return;
    setSelected(
      new Set(
        search.siblings
          .filter((s) => canPick(s) && (s.itemLevel ?? 0) >= DEFAULT_MIN_LEVEL)
          .map((s) => s.name),
      ),
    );
  }, [search]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const selectable = search.siblings.filter(canPick);

  return (
    <div className="space-y-3">
      <form action={searchSubmit} className="flex flex-wrap items-end gap-2">
        {/* 힌트를 라벨 옆에 두면 좁은 칸에서 줄이 갈린다. 자리표시자가 같은 일을 한다. */}
        <Field label="내 캐릭터 아무거나" className="w-48">
          <input
            name="name"
            required
            placeholder="원정대의 아무 캐릭터"
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </Field>
        <input type="hidden" name="slug" value={slug} />
        <button
          type="submit"
          disabled={searching}
          className="btn-inline rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {searching ? "조회 중…" : "조회"}
        </button>
        <Feedback status={search.status} message={search.message} />
      </form>

      {search.status === "ok" && search.siblings.length > 0 && (
        <form action={importSubmit} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          {/*
            조회할 때 친 이름을 그대로 넘긴다. 이 한 번이 원정대 하나가 되고 이 이름이
            캐릭터 관리의 탭 이름이 된다(members.ts의 claimNames).
          */}
          <input type="hidden" name="roster" value={search.searched} />

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setSelected(new Set(selectable.map((s) => s.name)))}
                className="rounded border border-border px-2 py-1 text-text-dim hover:text-text"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded border border-border px-2 py-1 text-text-dim hover:text-text"
              >
                전체 해제
              </button>
            </div>
          </div>

          <ul className="grid max-h-72 gap-1 overflow-y-auto rounded border border-border bg-bg p-2 sm:grid-cols-2 xl:grid-cols-3">
            {search.siblings.map((sibling) => (
              <li key={sibling.name}>
                <label
                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                    canPick(sibling)
                      ? "cursor-pointer hover:bg-surface-2"
                      : "text-text-faint"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="names"
                    value={sibling.name}
                    checked={selected.has(sibling.name)}
                    disabled={!canPick(sibling)}
                    onChange={() => toggle(sibling.name)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{sibling.name}</span>
                  <span className="shrink-0 text-xs text-text-faint">
                    {sibling.className}
                  </span>
                  <span className="shrink-0 text-xs tabular">
                    {sibling.itemLevel?.toFixed(2) ?? "-"}
                  </span>
                  {sibling.registered && (
                    <span className="shrink-0 text-xs text-text-faint">
                      {sibling.unclaimed ? "소속 없음" : "등록됨"}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={importing || selected.size === 0}
              className="btn-inline rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {importing ? "등록 중…" : `${selected.size}개 등록`}
            </button>
            <span className="text-xs text-text-faint">
              캐릭터마다 API를 한 번씩 부릅니다. 많이 고르면 시간이 걸립니다.
            </span>
            <Feedback status={imported.status} message={imported.message} />
          </div>

          {imported.result && imported.result.failed.length > 0 && (
            <ul className="space-y-0.5 text-xs text-danger">
              {imported.result.failed.map((f) => (
                <li key={f.name}>
                  {f.name}: {f.reason}
                </li>
              ))}
            </ul>
          )}
        </form>
      )}
    </div>
  );
}

/**
 * 라벨 + 입력창 한 덩어리.
 *
 * 너비를 입력창이 아니라 여기에 준다. 라벨에만 맡기면 힌트 글자가 길 때 덩어리가
 * 입력창보다 넓어져, 옆에 선 버튼이 그만큼 밀려 입력창과 뚝 떨어져 보인다.
 */
function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-text-dim">
        {label}
        {hint && <span className="ml-1 text-text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Feedback({ status, message }: { status: string; message: string }) {
  if (status === "idle" || !message) return null;
  return (
    <span className={`text-xs ${status === "error" ? "text-danger" : "text-ok"}`}>
      {message}
    </span>
  );
}

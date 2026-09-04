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
const DEFAULT_MIN_LEVEL = 1600;

/**
 * 부캐를 묶는 "사람 이름"은 묻지 않는다. 들어와 있는 사람의 디스코드 닉네임으로
 * 서버가 채운다(characters/actions.ts).
 *
 * 남의 캐릭터를 대신 등록하면 그 사람 것이 내 이름으로 묶여 중복 참여 경고가 엉뚱하게
 * 뜬다. 경고일 뿐 막지는 않으므로 칸을 하나 더 두는 값보다 낫다고 봤다.
 */
export function RegisterPanel({ slug }: { slug: string }) {
  const [mode, setMode] = useState<"single" | "siblings">("siblings");

  return (
    <section className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex gap-1">
        <ModeButton active={mode === "siblings"} onClick={() => setMode("siblings")}>
          원정대 불러오기
        </ModeButton>
        <ModeButton active={mode === "single"} onClick={() => setMode("single")}>
          한 명씩 등록
        </ModeButton>
      </div>

      {mode === "siblings" ? <SiblingsForm slug={slug} /> : <SingleForm slug={slug} />}
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

function SingleForm({ slug }: { slug: string }) {
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

  // 조회 결과가 새로 오면 쓸 만한 것만 미리 골라 둔다.
  // 25개를 전부 등록하면 API 요청도 그만큼 나가고 목록도 저렙 부캐로 덮인다.
  useEffect(() => {
    if (search.status !== "ok") return;
    setSelected(
      new Set(
        search.siblings
          .filter((s) => !s.registered && (s.itemLevel ?? 0) >= DEFAULT_MIN_LEVEL)
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

  const selectable = search.siblings.filter((s) => !s.registered);

  return (
    <div className="space-y-3">
      <form action={searchSubmit} className="flex flex-wrap items-end gap-2">
        {/* 힌트를 라벨 옆에 두면 좁은 칸에서 줄이 갈린다. 자리표시자가 같은 일을 한다. */}
        <Field label="대표 캐릭터 닉네임" className="w-48">
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

          <ul className="grid max-h-72 gap-1 overflow-y-auto rounded border border-border bg-bg p-2 sm:grid-cols-2">
            {search.siblings.map((sibling) => (
              <li key={sibling.name}>
                <label
                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                    sibling.registered
                      ? "text-text-faint"
                      : "cursor-pointer hover:bg-surface-2"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="names"
                    value={sibling.name}
                    checked={selected.has(sibling.name)}
                    disabled={sibling.registered}
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
                    <span className="shrink-0 text-xs text-text-faint">등록됨</span>
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

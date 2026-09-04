"use client";

import { useActionState, useEffect, useState } from "react";

import { readMyName } from "../MyNameField";
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
      <Field label="캐릭터 닉네임">
        <input
          name="name"
          required
          placeholder="정확한 닉네임"
          className="w-48 rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </Field>
      <Field label="사람 이름" hint="선택. 부캐를 묶는 이름">
        <input
          name="memberLabel"
          placeholder="디코 닉"
          className="w-36 rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </Field>
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
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
  const [memberLabel, setMemberLabel] = useState("");

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
    setMemberLabel((current) => current || readMyName() || search.searched);
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
        <Field label="대표 캐릭터 닉네임" hint="같은 원정대의 아무 캐릭터나">
          <input
            name="name"
            required
            placeholder="본캐 닉네임"
            className="w-48 rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </Field>
        <input type="hidden" name="slug" value={slug} />
        <button
          type="submit"
          disabled={searching}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {searching ? "조회 중…" : "원정대 조회"}
        </button>
        <Feedback status={search.status} message={search.message} />
      </form>

      {search.status === "ok" && search.siblings.length > 0 && (
        <form action={importSubmit} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />

          <div className="flex flex-wrap items-end gap-2">
            <Field label="사람 이름" hint="이 캐릭터들을 한 사람으로 묶습니다">
              <input
                name="memberLabel"
                value={memberLabel}
                onChange={(e) => setMemberLabel(e.target.value)}
                placeholder="디코 닉"
                className="w-36 rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </Field>
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
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {importing ? "등록 중…" : `${selected.size}개 등록`}
            </button>
            <span className="text-xs text-text-faint">
              캐릭터마다 API를 한 번씩 부른다. 많이 고르면 시간이 걸린다.
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
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

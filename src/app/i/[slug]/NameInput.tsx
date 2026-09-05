"use client";

import {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/**
 * 이미 등록된 캐릭터 이름.
 *
 * 칸마다 배열을 내려보내면 같은 목록이 칸 수만큼 직렬화된다. 한 번만 실어 보내고
 * 컨텍스트로 꺼내 쓴다.
 */
const KnownNamesContext = createContext<readonly string[]>([]);

export function KnownNamesProvider({
  names,
  children,
}: {
  names: readonly string[];
  children: ReactNode;
}) {
  return <KnownNamesContext value={names}>{children}</KnownNamesContext>;
}

/** 입력한 글자로 후보를 좁힌다. 앞부분이 맞는 이름을 먼저 보여준다. */
function suggest(names: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    if (lower === q) continue; // 이미 다 친 이름을 다시 권하지 않는다
    if (lower.startsWith(q)) starts.push(name);
    else if (lower.includes(q)) contains.push(name);
    if (starts.length >= 8) break;
  }
  return [...starts, ...contains].slice(0, 8);
}

/**
 * 닉네임 입력.
 *
 * `<datalist>`를 쓰면 브라우저가 오른쪽에 펼침 화살표를 그려 콤보박스처럼 보인다.
 * 이 칸은 목록에서 고르는 자리가 아니라 이름을 치는 자리이고, 등록되지 않은 캐릭터도
 * 그대로 받아야 한다. 그래서 친 글자에 맞는 후보만 아래에 띄운다.
 */
export function NameInput({
  name,
  pending,
  resetOn,
  error,
  placeholder,
  className,
}: {
  name: string;
  /** 조회 중. 칸 자체가 상태를 말하므로 아래에 줄을 더하지 않는다. */
  pending?: boolean;
  /** 이 값이 바뀌면 입력을 비운다. 배치가 끝났다는 신호로 쓴다. */
  resetOn?: unknown;
  /** 실패 사유. 칸 위에 말풍선으로 띄운다. */
  error?: string | null;
  placeholder?: string;
  /** 표에서는 테두리 없는 칸으로 쓴다. 기본은 카드 안의 입력창이다. */
  className?: string;
}) {
  const names = useContext(KnownNamesContext);
  const [value, setValue] = useState("");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  /*
   * 배치가 끝나면 친 이름을 지운다.
   *
   * 보통은 칸이 캐릭터 카드로 바뀌면서 이 입력창이 사라지지만, 딜 칸에 폿을 치면
   * 폿 자리로 옮겨 앉아 이 칸은 빈 채로 남는다. 그때 방금 친 이름이 그대로 있으면
   * 넣긴 넣었는데 실패한 것처럼 보인다.
   *
   * effect가 아니라 렌더 중에 맞춘다. React가 권하는 "prop이 바뀌면 state를 맞추는"
   * 방식이고, effect로 하면 화면을 한 번 그린 뒤 또 그리게 된다.
   */
  const [lastReset, setLastReset] = useState(resetOn);
  if (resetOn !== lastReset) {
    setLastReset(resetOn);
    if (resetOn && value !== "") setValue("");
  }

  const items = useMemo(() => suggest(names, value), [names, value]);
  const showing = open && !pending && items.length > 0;

  /** 후보를 고르면 그대로 넣고 폼을 보낸다. 한 번 더 엔터를 치게 하지 않는다. */
  function choose(picked: string) {
    setValue(picked);
    setOpen(false);
    setActive(-1);
    // 값이 state로 반영된 뒤 제출되도록 다음 프레임으로 미룬다.
    requestAnimationFrame(() => inputRef.current?.form?.requestSubmit());
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // 조회 중에는 아무것도 받지 않는다. 엔터를 또 치면 "조회 중…"이 그대로 넘어간다.
    if (pending) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      if (showing) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else {
        setValue("");
      }
      return;
    }
    if (!showing) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      // 후보를 짚어둔 상태의 엔터는 그 후보를 고르는 것이다.
      e.preventDefault();
      choose(items[active]!);
    }
  }

  return (
    <div className="combo">
      <input
        ref={inputRef}
        name={name}
        // 조회하는 동안 칸이 곧 상태 표시다. 값을 잠깐 바꿔 끼우고 손대지 못하게 둔다.
        value={pending ? "조회 중…" : value}
        readOnly={pending}
        required
        autoComplete="off"
        placeholder={placeholder ?? "캐릭터 입력"}
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          if (pending) return;
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        // 후보를 클릭하는 중에도 blur가 먼저 나므로 닫는 것을 조금 미룬다.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onFocus={() => setOpen(!pending)}
        className={className ?? "char-input"}
      />

      {/*
        실패 사유는 칸 위에 띄운다. 아래에 줄로 붙이면 칸이 그만큼 자라 입력창이
        위로 밀리고, 방금 친 자리에서 손이 한 번 헛돈다.
      */}
      {error && !showing && (
        <p role="alert" className="combo-error">
          {error}
        </p>
      )}

      {showing && (
        <ul id={listId} role="listbox" className="combo-list">
          {items.map((item, i) => (
            <li key={item}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
                className={`combo-item ${i === active ? "is-active" : ""}`}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useId, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";

/**
 * 후보 목록이 붙은 입력 칸.
 *
 * `<datalist>`는 목록을 브라우저가 띄운다. 그 창은 페이지 바깥에 그려져 확대 배율이나
 * 화면 배율이 100%가 아니면 엉뚱한 자리에 뜨고, 모양도 손댈 수 없다. 칸 아래에 직접
 * 그린다. NameInput과 같은 이유이고 같은 CSS를 쓴다.
 *
 * 목록은 제안일 뿐이라 없는 값을 쳐 넣어도 그대로 받는다.
 */
export function PickInput({
  options,
  value,
  onChange,
  format,
  wrapClassName,
  ...rest
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  /** 친 글자를 다듬는다. 시간 칸이 "2000"을 "20:00"으로 바꾸는 데 쓴다. */
  format?: (value: string) => string;
  wrapClassName?: string;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "list">) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const items = useMemo(() => {
    const q = value.trim().toLowerCase();
    // 이미 고른 값이 들어 있으면 좁히지 않는다. 다른 후보로 갈아타는 길을 막지 않는다.
    if (!q || options.some((o) => o.toLowerCase() === q)) return options;

    const narrowed = options.filter((o) => o.toLowerCase().includes(q));
    // 걸리는 후보가 없으면 좁히기를 포기하고 전부 보여준다. 빈 목록은 고를 길을 막는다.
    return narrowed.length > 0 ? narrowed : options;
  }, [options, value]);

  const showing = open && items.length > 0;

  function choose(picked: string) {
    // 목록에서 고르면 input 이벤트가 없어 앞선 오류 문구가 그대로 남는다.
    inputRef.current?.setCustomValidity("");
    onChange(picked);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (e.key === "ArrowDown" && !showing) {
      setOpen(true);
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
      // 후보를 짚어둔 상태의 엔터는 고르는 것이다. 폼이 먼저 나가지 않게 막는다.
      e.preventDefault();
      choose(items[active]!);
    }
  }

  return (
    <div className={`combo ${wrapClassName ?? ""}`}>
      <input
        {...rest}
        ref={inputRef}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          // 앞선 검사에서 붙은 문구를 지운다. 남으면 고쳐 넣어도 계속 막힌다.
          e.target.setCustomValidity("");
          onChange(format ? format(e.target.value) : e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        // 후보를 클릭하는 중에도 blur가 먼저 나므로 닫는 것을 조금 미룬다.
        onBlur={() => {
          if (closeTimer.current) clearTimeout(closeTimer.current);
          closeTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />

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

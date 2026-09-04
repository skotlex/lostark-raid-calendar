"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "loa-raid-board:my-name";

/**
 * 편집자 이름.
 *
 * 로그인이 없는 구조라 "누가 했는지"를 남길 수단이 이것뿐이다. 검증되지 않는 값이고
 * 그 한계를 아는 채로 쓴다. 변경 기록과 신청자 표시에 들어간다.
 */
export function readMyName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // 사생활 보호 모드 등에서 접근이 막힐 수 있다. 이름이 없어도 앱은 동작해야 한다.
    return "";
  }
}

export function MyNameField() {
  const [name, setName] = useState("");
  // 서버 렌더 결과와 어긋나지 않도록 첫 렌더 이후에 값을 읽는다.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setName(readMyName());
    setReady(true);
  }, []);

  function save(value: string) {
    setName(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // 저장이 막혀도 이번 세션 동안은 입력값이 유지된다.
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-text-faint">내 이름</span>
      <input
        value={ready ? name : ""}
        onChange={(e) => save(e.target.value)}
        placeholder="디코 닉"
        className="w-28 rounded border border-border bg-bg px-2 py-1 text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
      />
    </label>
  );
}

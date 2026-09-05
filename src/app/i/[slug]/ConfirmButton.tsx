"use client";

import { useRef, type ReactNode } from "react";

/**
 * 확인을 받고 폼을 보내는 버튼.
 *
 * `confirm()`은 브라우저·OS가 그리는 창이라 "Code"라는 앱 이름이 제목으로 뜨고, 글꼴도
 * 버튼 모양도 화면과 따로 논다. 되돌릴 수 없는 일을 묻는 자리인데 정작 이 사이트의
 * 물건처럼 보이지 않는다.
 *
 * `<dialog>`를 직접 그린다. 브라우저가 top-layer·포커스 가둠·Esc 닫기를 해주므로
 * 손으로 만드는 모달보다 안전하다. 안에 `<form>`을 두지 않는 것이 중요하다.
 * 이 버튼은 이미 폼 안에 있고, 폼 안의 폼은 HTML이 허용하지 않는다.
 *
 * `when`이 false면 묻지 않고 그냥 보낸다. 편성 칸처럼 **남의 것을 지울 때만** 묻는
 * 자리가 있어서다.
 */
export function ConfirmButton({
  message,
  confirmLabel = "확인",
  when = true,
  danger = true,
  disabled,
  className,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  message: ReactNode;
  confirmLabel?: string;
  when?: boolean;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function send() {
    dialogRef.current?.close();
    // 폼의 action(서버 액션)을 그대로 태운다. 버튼이 폼 안에 있어 form을 바로 찾는다.
    buttonRef.current?.form?.requestSubmit();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        className={className}
        onClick={() => (when ? dialogRef.current?.showModal() : send())}
      >
        {children}
      </button>

      <dialog ref={dialogRef} className="confirm">
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-cancel"
            onClick={() => dialogRef.current?.close()}
          >
            취소
          </button>
          <button
            type="button"
            className={`confirm-ok ${danger ? "is-danger" : ""}`}
            onClick={send}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}

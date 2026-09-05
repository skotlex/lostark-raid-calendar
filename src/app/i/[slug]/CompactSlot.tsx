"use client";

import {
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// board.ts는 server-only다. 타입만 가져온다.
import type { BoardSlotView, CellView } from "@/lib/board";
import { classEmblem } from "@/lib/classEmblems";
import { positionLabel } from "@/lib/positions";
import { getSynergies } from "@/lib/synergy";

import { NameInput } from "./NameInput";
import { SlotHeader } from "./SlotHeader";
import {
  type CellState,
  assignAction,
  moveAction,
  pinAction,
  unassignAction,
} from "./actions";
import { DRAG_TYPE, moveForm, readDragSource, writeDragSource } from "./dragCell";
import { ConfirmButton } from "./ConfirmButton";
import { CloseIcon, GripIcon, PinIcon, WarnIcon } from "./icons";

const IDLE: CellState = { status: "idle", message: "" };

/**
 * 간략 보기 — 8인이 한 줄에 들어가는 표.
 *
 * 카드는 초상·각인·아크그리드까지 보여주는 대신 8인이 두 줄로 갈린다. 편성을 짤 때는
 * 여덟을 한눈에 놓고 시너지를 맞추는 편이 빠르다. 시트에서 쓰던 모양이기도 하다.
 *
 * 세로가 항목, 가로가 자리다. 같은 항목이 한 줄에 늘어서므로 템레벨이 낮은 사람이나
 * 시너지가 겹치는 자리가 눈으로 잡힌다. 카드로는 칸마다 위치가 달라 그게 안 된다.
 *
 * **4인 레이드는 이 보기를 쓰지 않는다.** 넷은 카드로도 한 줄에 들어가고, 초상까지
 * 보이는 편이 낫다(page.tsx에서 가른다).
 */
export function CompactSlot({
  slug,
  week,
  slot,
  editable,
}: {
  slug: string;
  week: string;
  slot: BoardSlotView;
  editable: boolean;
}) {
  const cells = slot.parties.flatMap((party) => party.cells);

  return (
    <section className="rounded border border-border bg-surface">
      <SlotHeader slug={slug} week={week} slot={slot} editable={editable} />

      {/* 좁은 화면에서는 표가 가로로 스크롤된다. 칸을 더 줄여 뭉개는 것보다 낫다. */}
      <div className="overflow-x-auto">
        <table className="board-table">
          <thead>
            <tr>
              <th className="board-head">구분</th>
              {cells.map((cell) => (
                <HeadCell
                  key={cell.position}
                  slug={slug}
                  slotId={slot.id}
                  week={week}
                  cell={cell}
                  editable={editable}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              <th className="board-label">캐릭터</th>
              {cells.map((cell) => (
                <NameCell
                  key={cell.position}
                  slug={slug}
                  slotId={slot.id}
                  week={week}
                  cell={cell}
                  taken={slot.takenNames}
                  editable={editable}
                />
              ))}
            </tr>

            <Row label="클래스" cells={cells} render={(c) => <ClassName cell={c} />} />
            <Row
              label="템레벨"
              cells={cells}
              render={(c) => format(c.character?.itemLevel)}
              tabular
            />
            <Row
              label="전투력"
              cells={cells}
              render={(c) => format(c.character?.combatPower)}
              tabular
            />
            <Row label="시너지" cells={cells} render={synergyText} />
          </tbody>
        </table>
      </div>

    </section>
  );
}

function format(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : value.toFixed(2);
}

/** "치적 10%, 받피증 6%". 카드의 칩과 같은 값을 글자로만 적는다. */
function synergyText(cell: CellView): string {
  const character = cell.character;
  if (!character) return "";

  return getSynergies(character.className, character.role, character.skillSynergies)
    .map((s) => (s.value ? `${s.kind} ${s.value}` : s.kind))
    .join(", ");
}

function Row({
  label,
  cells,
  render,
  tabular,
}: {
  label: string;
  cells: CellView[];
  /** 대부분은 글자지만 클래스 줄만 문장 아이콘을 함께 그린다. */
  render: (cell: CellView) => ReactNode;
  tabular?: boolean;
}) {
  return (
    <tr>
      <th className="board-label">{label}</th>
      {cells.map((cell) => (
        <td key={cell.position} className={`board-cell ${tabular ? "tabular" : ""}`}>
          {render(cell)}
        </td>
      ))}
    </tr>
  );
}

/**
 * 클래스 줄 — 직업 문장 + 직업명.
 *
 * 여덟 칸이 한 줄에 늘어서는 표라 클래스만 훑는 일이 잦은데, 글자는 길이가 제각각이라
 * 눈이 한 칸씩 읽어야 한다. 문장이 앞에 서면 읽기 전에 모양으로 걸린다.
 *
 * **카드와 달리 흰색으로 못 박지 않는다.** 표는 테마를 따라 바탕이 바뀌므로 흰색으로
 * 두면 라이트 모드에서 사라진다(globals.css의 .board-emblem).
 */
function ClassName({ cell }: { cell: CellView }) {
  const className = cell.character?.className;
  if (!className) return null;

  const emblem = classEmblem(className);

  return (
    <span className="board-class">
      {emblem && (
        // 게임 자산 SVG라 next/image를 거치지 않는다(숙제 화면과 같은 이유).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={emblem} alt="" width={16} height={16} loading="lazy" className="board-emblem" />
      )}
      <span className="truncate">{className}</span>
    </span>
  );
}

/**
 * 머리글 칸 — 자리 이름과 그 자리에 대한 조작.
 *
 * 옮기기·고정·비우기를 여기 모은다. 닉네임 칸에 두면 이름 옆이 버튼으로 붐벼서
 * 정작 먼저 읽어야 할 이름이 뒤로 밀린다. 자리에 대한 일이니 자리 이름 옆이 맞다.
 *
 * **끄는 손잡이도 여기다.** 이름을 끌게 하면 이름을 고르려다 끌리고, 빈 자리는
 * 끌 손잡이가 아예 없다.
 */
function HeadCell({
  slug,
  slotId,
  week,
  cell,
  editable,
}: {
  slug: string;
  slotId: string;
  week: string;
  cell: CellView;
  editable: boolean;
}) {
  const [pinState, pin, pinning] = useActionState(pinAction, IDLE);
  const [removeState, remove, removing] = useActionState(unassignAction, IDLE);
  const [moveState, move, moving] = useActionState(moveAction, IDLE);
  const [dropping, setDropping] = useState(false);

  const busy = pinning || removing || moving;
  const error = [pinState, removeState, moveState].find((s) => s.status === "error");
  const character = cell.character;
  const filled = Boolean(character);

  // 빈 칸도 드롭을 받는다. 받는 칸이 차 있으면 서버에서 맞바꾼다.
  function onDragOver(e: DragEvent<HTMLElement>) {
    if (!editable || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
    // preventDefault를 해야 이 칸이 드롭을 받는다.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropping(true);
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    setDropping(false);
    if (!editable) return;

    const from = readDragSource(e);
    if (!from) return;
    e.preventDefault();
    if (from.slotId === slotId && from.position === cell.position) return;

    // drop 핸들러에서 부르는 것이라 전환을 직접 연다(Cell.tsx와 같은 이유).
    startTransition(() =>
      move(moveForm({ slug, week, from, to: { slotId, position: cell.position } })),
    );
  }

  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="position" value={cell.position} />
    </>
  );

  return (
    <th
      className="board-head"
      data-sup={cell.position.startsWith("SUP") ? "" : undefined}
      data-dropping={dropping ? "" : undefined}
      draggable={editable && filled}
      onDragStart={(e) => writeDragSource(e, { slotId, position: cell.position })}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={() => setDropping(false)}
      title={error?.message}
    >
      <div className="board-head-row">
        {/* 끌 수 있다는 표시. 사람이 없으면 끌 것도 없어 자리만 지킨다. */}
        <span className="board-grip" data-on={editable && filled ? "" : undefined} aria-hidden>
          <GripIcon />
        </span>

        <span className="truncate">{positionLabel(cell.position)}</span>

        {editable && filled && (
          <span className="board-actions">
            <form action={pin}>
              {hidden}
              <input type="hidden" name="pinned" value={cell.pinned ? "false" : "true"} />
              <button
                type="submit"
                disabled={busy}
                title={cell.pinned ? "고정 해제" : "이 자리 고정 (리셋에서 제외)"}
                aria-label={cell.pinned ? "고정 해제" : "자리 고정"}
                className={`flex transition-colors ${
                  cell.pinned ? "text-accent" : "text-text-faint hover:text-text"
                }`}
              >
                <PinIcon pinned={cell.pinned} />
              </button>
            </form>

            <form action={remove}>
              {hidden}
              {/* 남이 넣은 신청을 지울 때만 묻는다. 카드 쪽과 같은 규칙이다. */}
              <ConfirmButton
                when={Boolean(cell.createdByLabel) && !cell.mine}
                message={`${cell.createdByLabel}님이 넣은 ${character?.name}을(를) 빼시겠습니까?`}
                confirmLabel="빼기"
                disabled={busy}
                title="자리 비우기"
                aria-label="자리 비우기"
                className="flex text-text-faint transition-colors hover:text-danger disabled:opacity-50"
              >
                <CloseIcon />
              </ConfirmButton>
            </form>
          </span>
        )}
      </div>
    </th>
  );
}

/**
 * 닉네임 칸.
 *
 * 표에서도 칸에 이름을 쳐서 넣는다. 이게 이 앱의 주 입력 경로라 보기를 바꿨다고
 * 카드로 돌아가 넣게 하지 않는다(CLAUDE.md 2-2).
 *
 * 빈 칸의 입력창은 테두리 없이 둔다. 상자를 그리면 그 줄만 키가 커져 표가 어긋나고,
 * 여덟 칸이 모두 비어 있을 때는 상자 여덟 개가 늘어서 표가 입력 폼처럼 보인다.
 *
 * **차 있는 칸도 이름을 눌러 그 자리에서 고쳐 쓴다.** 사람을 바꾸려면 x로 비우고 다시
 * 치는 두 걸음이었다. 표는 칸을 눌러 덮어쓰는 것이 몸에 익은 모양이고 시트에서도
 * 그랬다. 걸음이 하나 줄기도 하지만, 비워 놓고 새로 칠 이름이 생각나지 않아 칸만
 * 비는 일이 없어지는 쪽이 크다. x는 그대로 둔다. 빼기만 할 때는 그쪽이 맞다.
 *
 * **엔터 전까지는 아무 일도 일어나지 않는다.** Esc나 칸 밖 클릭이면 원래 이름이 그대로
 * 남는다. 잘못 눌러 여는 일이 잦을 자리라 되돌리는 길이 늘 열려 있어야 한다.
 *
 * 열면서 이름을 지우고 빈 칸으로 시작한다. 남겨두면 지우고 치게 되고, 지우다 만 채로
 * 물러났을 때 무엇이 원래 이름이었는지가 흐려진다.
 *
 * 카드 보기에는 넣지 않는다. 이름이 초상·각인과 한 덩어리라 누를 자리로 보이지 않고,
 * 칸이 넓어 x도 눈에 잘 띈다.
 */
function NameCell({
  slug,
  slotId,
  week,
  cell,
  taken,
  editable,
}: {
  slug: string;
  slotId: string;
  week: string;
  cell: CellView;
  /** 이 레이드에 이미 들어간 캐릭터. 자동완성에서 뺀다 */
  taken: string[];
  editable: boolean;
}) {
  const [assignState, assign, assigning] = useActionState(assignAction, IDLE);
  /** 차 있는 칸을 눌러 입력을 연 상태. 빈 칸은 늘 입력이라 이 값과 상관없다. */
  const [editing, setEditing] = useState(false);
  const error = assignState.status === "error" ? assignState : null;
  const character = cell.character;

  /*
   * 넣고 나면 입력을 닫는다.
   *
   * 이 컴포넌트는 자리에 붙어 있어 배정이 바뀌어도 살아남는다. 그냥 두면 방금 넣은
   * 이름 위에 빈 입력이 계속 떠 있다.
   *
   * 상태가 **바뀐 순간**만 본다. "지금 ok"로 보면 넣고 난 뒤 같은 칸을 다시 눌렀을 때
   * 옛 성공 상태가 그대로 남아 있어 열자마자 닫힌다.
   */
  const [lastState, setLastState] = useState(assignState);
  if (assignState !== lastState) {
    setLastState(assignState);
    if (assignState.status === "ok") setEditing(false);
  }

  if (!character && !editable) {
    return (
      <td className="board-cell board-cell--name">
        <span className="text-text-faint">-</span>
      </td>
    );
  }

  if (editable && (!character || editing)) {
    return (
      <td className="board-cell board-cell--name">
        <form action={assign}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="slotId" value={slotId} />
          <input type="hidden" name="week" value={week} />
          <input type="hidden" name="position" value={cell.position} />
          <NameInput
            name="characterName"
            pending={assigning}
            resetOn={assignState.status === "ok" ? assignState : null}
            error={error?.message}
            taken={taken}
            placeholder="캐릭터 입력"
            className="board-input"
            autoFocus={editing}
            onCancel={
              editing
                ? () => {
                    // 보내는 중이면 물러나지 않는다. 폼이 사라지면 결과가 닿을 곳이
                    // 없어져, 넣긴 넣었는데 칸은 옛 이름인 상태가 된다.
                    if (!assigning) setEditing(false);
                  }
                : undefined
            }
          />
        </form>
      </td>
    );
  }

  const warned = cell.warnings.length > 0;

  return (
    <td className="board-cell board-cell--name">
      {/*
        경고 표시는 이름 양옆에 같은 것이 하나씩 선다. 한쪽에만 두면 그 칸의 이름만
        반대쪽으로 밀려, 여덟 칸의 이름이 저마다 다른 자리에서 시작한다. 표는 같은
        항목이 한 줄에 늘어서는 것으로 읽는 보기라 그 어긋남이 그대로 눈에 걸린다.
        어느 쪽을 눌러도 같은 말풍선이 뜬다.
      */}
      <div className="board-name">
        {warned && <WarnBadge warnings={cell.warnings} />}
        {editable ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="board-name-edit truncate"
            title={`${character!.name} — 눌러서 다른 캐릭터로 바꿉니다`}
          >
            {character!.name}
          </button>
        ) : (
          <span className="truncate" title={character!.name}>
            {character!.name}
          </span>
        )}
        {warned && <WarnBadge warnings={cell.warnings} />}
      </div>
    </td>
  );
}

/** 말풍선이 화면 가장자리에 남겨야 할 여백. */
const BUBBLE_MARGIN = 8;

/**
 * 경고 — 이름 옆의 표시와 눌러서 여는 말풍선.
 *
 * 문장을 이름 아래에 그대로 깔면 한 칸이 이름 너비뿐이라 서너 줄로 접히고, 그 줄만
 * 키가 커져 여덟 칸이 어긋난다. 표는 여덟을 한 줄에 놓고 훑는 보기라 줄이 어긋나면
 * 이 보기를 쓰는 이유가 없어진다. 그래서 있다는 것만 아이콘으로 알리고 문장은 눌렀을
 * 때 띄운다. 경고는 막는 것이 아니라 알리는 것이라(CLAUDE.md 3.4) 늘 펼쳐 둘 것도 아니다.
 *
 * **말풍선은 fixed다.** 표가 overflow-x: auto 안에 있어 칸에 붙여 그리면 잘리거나
 * 없던 가로 스크롤이 생긴다. 화면 기준으로 띄우면 그 상자를 벗어난다.
 */
function WarnBadge({ warnings }: { warnings: string[] }) {
  /** 누른 아이콘의 화면 좌표. null이면 닫혀 있다. */
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [left, setLeft] = useState(0);
  const bubble = useRef<HTMLDivElement>(null);

  // 화면 밖으로 나가면 안으로 민다. 표가 가로로 넓어 양끝 칸이 특히 위험하다.
  // 그리기 전에 옮겨야 말풍선이 한 번 튀지 않는다.
  useLayoutEffect(() => {
    const width = bubble.current?.offsetWidth;
    if (!anchor || !width) return;

    const half = width / 2;
    const min = BUBBLE_MARGIN + half;
    const max = Math.max(window.innerWidth - BUBBLE_MARGIN - half, min);
    setLeft(Math.min(Math.max(anchor.x, min), max));
  }, [anchor]);

  // 3초 뒤에 저절로 닫힌다. 닫는 법을 따로 알려주지 않아도 되고, 좁은 표에서 오래
  // 떠 있으면 아래 줄을 가린다.
  useEffect(() => {
    if (!anchor) return;
    const timer = setTimeout(() => setAnchor(null), 3000);
    return () => clearTimeout(timer);
  }, [anchor]);

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    // 열려 있는데 또 누르면 닫는다. 3초를 기다리게 하지 않는다.
    if (anchor) {
      setAnchor(null);
      return;
    }

    const box = e.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    // 첫 그림도 아이콘 아래에서 시작한다. 0에서 시작하면 왼쪽 끝에서 미끄러져 온다.
    setLeft(x);
    setAnchor({ x, y: box.bottom + 6 });
  }

  return (
    <span className="board-warn">
      <button
        type="button"
        onClick={toggle}
        className="board-warn-icon"
        title="경고 보기"
        aria-label="경고 보기"
        aria-expanded={anchor !== null}
      >
        <WarnIcon />
      </button>

      {anchor && (
        <div
          ref={bubble}
          role="status"
          className="board-warn-bubble"
          style={
            {
              left: left + "px",
              top: anchor.y + "px",
              // 꼬리는 말풍선이 밀린 만큼 되돌려 아이콘을 가리킨다.
              "--tail": anchor.x - left + "px",
            } as CSSProperties
          }
        >
          {warnings.map((warning) => (
            <span key={warning} className="block">
              {warning}
            </span>
          ))}
        </div>
      )}
    </span>
  );
}

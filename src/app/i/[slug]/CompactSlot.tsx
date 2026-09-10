"use client";

import {
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useState,
} from "react";

// board.ts는 server-only다. 타입만 가져온다.
import type { BoardSlotView, CellView, PartyView } from "@/lib/board";
import { classEmblem } from "@/lib/classEmblems";
import { positionLabel } from "@/lib/positions";
import { getSynergies, synergyLabel } from "@/lib/synergy";

import { NameInput } from "./NameInput";
import { useBubble, useReveal } from "./Reveal";
import { presenceColor, useCellViewers, useFocusReport } from "./Presence";
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
 * 간략 보기 — 한 파티가 한 줄에 들어가는 표.
 *
 * 카드는 초상·각인·아크그리드까지 보여주는 대신 여덟이 두 줄로 갈린다. 편성을 짤 때는
 * 한눈에 놓고 시너지를 맞추는 편이 빠르다. 시트에서 쓰던 모양이기도 하다.
 *
 * 세로가 항목, 가로가 자리다. 같은 항목이 한 줄에 늘어서므로 템레벨이 낮은 사람이나
 * 시너지가 겹치는 자리가 눈으로 잡힌다. 카드로는 칸마다 위치가 달라 그게 안 된다.
 *
 * **파티마다 표가 하나다.** 시너지가 4인 파티 단위로 걸리므로(CLAUDE.md 2-1) 그 경계가
 * 보이는 편이 맞고, 4인 레이드는 그 표 하나가 그대로 답이 된다. 넷은 카드로도 한 줄에
 * 들어가지만, 간략 보기를 골랐는데 어떤 레이드만 카드로 남으면 한 화면에 두 모양이 섞여
 * 무엇을 고른 것인지가 흐려진다.
 *
 * 좁은 화면에서는 두 파티가 위아래로 쌓인다(globals.css). 여덟 칸을 한 줄에 밀어 넣으면
 * 가로로 밀어야 하는데, 미는 동안에도 눈에 들어오는 것은 어차피 넷씩이다. 그럴 바에는
 * 파티 경계에서 접는 편이 낫다 — 시너지를 세는 단위가 그것이라 넷이 한 화면에 들어오면
 * 그 파티는 온전히 읽힌다.
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
  return (
    <section className="rounded border border-border bg-surface">
      <SlotHeader slug={slug} week={week} slot={slot} editable={editable} />

      <div className="board-parties">
        {slot.parties.map((party) => (
          <PartyTable
            key={party.index}
            slug={slug}
            week={week}
            slot={slot}
            party={party}
            editable={editable}
          />
        ))}

        {/*
          4인 레이드의 빈 오른쪽 절반.

          칸을 늘려 폭을 채우지 않는다. 늘리면 같은 화면의 8인 표와 칸 크기가 달라져
          위아래로 늘어선 레이드가 저마다 다른 격자를 갖는다. 넷은 왼쪽 절반에 8인과
          같은 폭으로 서고, 남는 자리는 사선을 그어 쓰지 않는 곳임을 말한다 — 그냥
          비워두면 아직 안 그려진 칸처럼 읽힌다.
        */}
        {slot.parties.length === 1 && (
          <div className="board-unused" aria-hidden title="4인 레이드입니다. 2파티가 없습니다" />
        )}
      </div>
    </section>
  );
}

/**
 * 파티 하나의 표.
 *
 * 항목 이름 열(`구분`·`캐릭터`…)은 두 파티가 나란히 설 때 첫 표에만 남는다. 지우지 않고
 * 감추는 이유는 위아래로 쌓이는 폭에서는 두 표 모두 그 열이 있어야 하기 때문이다.
 * 폭으로 갈리는 값이라 서버가 미리 정할 수 없다(globals.css).
 */
function PartyTable({
  slug,
  week,
  slot,
  party,
  editable,
}: {
  slug: string;
  week: string;
  slot: BoardSlotView;
  party: PartyView;
  editable: boolean;
}) {
  const cells = party.cells;

  return (
    /* 그래도 좁으면 그 파티만 가로로 밀린다. 칸을 더 줄여 뭉개는 것보다 낫다. */
    <div className="board-party">
      <table className="board-table">
        <thead>
          <tr>
            <th className="board-head board-head--first">구분</th>
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
                minLevel={slot.minLevel}
                editable={editable}
              />
            ))}
          </tr>

          <Row
            label="클래스"
            cells={cells}
            text={(c) => c.character?.className ?? ""}
            render={(c) => <ClassName cell={c} />}
          />
          <Row label="템레벨" cells={cells} text={(c) => format(c.character?.itemLevel)} tabular />
          <Row
            label="전투력"
            cells={cells}
            text={(c) => format(c.character?.combatPower)}
            tabular
          />
          <Row label="시너지" cells={cells} text={synergyText} />
        </tbody>
      </table>
    </div>
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
    .map((s) => (s.value ? `${synergyLabel(s.kind)} ${s.value}` : synergyLabel(s.kind)))
    .join(", ");
}

function Row({
  label,
  cells,
  text,
  render,
  tabular,
}: {
  label: string;
  cells: CellView[];
  /** 칸에 들어가는 글자 전체. 잘렸을 때 말풍선이 이걸 띄운다 */
  text: (cell: CellView) => string;
  /** 대부분은 글자 그대로지만 클래스 줄만 문장 아이콘을 함께 그린다 */
  render?: (cell: CellView) => ReactNode;
  tabular?: boolean;
}) {
  return (
    <tr>
      <th className="board-label">{label}</th>
      {cells.map((cell) => (
        <ValueCell
          key={cell.position}
          text={text(cell)}
          tabular={tabular}
          render={render ? render(cell) : undefined}
        />
      ))}
    </tr>
  );
}

/**
 * 값 칸 하나. 잘려 있으면 눌러서 펼친다(Reveal.tsx).
 *
 * 이 칸들에는 누르는 일이 따로 없어 탭을 그대로 쓴다. 이름 칸만 다르다 — 거기는
 * 탭이 편집을 여는 자리라 꾹 누르는 쪽으로 비켜 둔다.
 */
function ValueCell({
  text,
  render,
  tabular,
}: {
  text: string;
  render?: ReactNode;
  tabular?: boolean;
}) {
  const reveal = useReveal(text);

  return (
    <td {...reveal.props} className={`board-cell ${tabular ? "tabular" : ""}`}>
      {render ?? text}
      {reveal.bubble}
    </td>
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

  // 표에서는 한 자리가 곧 한 열이라 표식을 머리글에 세운다. 카드처럼 칸을 덮는
  // 막대를 놓으면 그 줄만 키가 커져 여덟 칸이 어긋난다(Presence.tsx).
  const others = useCellViewers(slotId, cell.position);
  const focusProps = useFocusReport(slotId, cell.position);

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

  // 표식이 선 동안에는 누가 만지는 중인지가 먼저다. 오류는 그다음 차례에 뜬다.
  const title =
    others.length > 0
      ? `${others.map((v) => v.label).join(", ")} 님이 이 자리를 보고 있습니다`
      : error?.message;

  return (
    <th
      {...focusProps}
      className="board-head"
      style={
        others.length > 0
          ? ({ "--presence": presenceColor(others[0].id) } as CSSProperties)
          : undefined
      }
      data-sup={cell.position.startsWith("SUP") ? "" : undefined}
      data-busy={others.length > 0 ? "" : undefined}
      data-dropping={dropping ? "" : undefined}
      draggable={editable && filled}
      onDragStart={(e) => writeDragSource(e, { slotId, position: cell.position })}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={() => setDropping(false)}
      title={title}
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
  minLevel,
  editable,
}: {
  slug: string;
  slotId: string;
  week: string;
  cell: CellView;
  /** 이 레이드에 이미 들어간 캐릭터. 자동완성에서 뺀다 */
  taken: string[];
  /** 이 레이드의 입장 템레벨. 미달 캐릭터를 자동완성에서 뺀다(NameInput) */
  minLevel: number | null;
  editable: boolean;
}) {
  const [assignState, assign, assigning] = useActionState(assignAction, IDLE);
  /** 차 있는 칸을 눌러 입력을 연 상태. 빈 칸은 늘 입력이라 이 값과 상관없다. */
  const [editing, setEditing] = useState(false);
  // 표식은 머리글에 서지만 알림은 여기서도 보낸다. 이름을 치는 자리가 여기다.
  const focusProps = useFocusReport(slotId, cell.position);
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
      <td className="board-cell board-cell--name" {...focusProps}>
        <span className="text-text-faint">-</span>
      </td>
    );
  }

  if (editable && (!character || editing)) {
    return (
      <td className="board-cell board-cell--name" {...focusProps}>
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
            minLevel={minLevel}
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

  return (
    <td className="board-cell board-cell--name" {...focusProps}>
      <CharacterName
        name={character!.name}
        warnings={cell.warnings}
        onEdit={editable ? () => setEditing(true) : undefined}
      />
    </td>
  );
}

/**
 * 이름 줄 — 이름과 경고 표시.
 *
 * **잘린 이름은 꾹 눌러 펼친다.** 짧게 누르는 것은 이미 편집 열기에 쓰이고 있어 그
 * 자리를 뺏을 수 없다. 좁은 화면에서는 칸이 한 뼘이라 긴 닉네임이 몇 글자로 끊기는데,
 * 터치에는 hover가 없어 그대로 두면 끝까지 읽을 길이 아예 없다(Reveal.tsx).
 *
 * 고칠 수 없는 화면(굳은 주차)에서는 탭이 비어 있으므로 짧게 눌러 펼친다.
 */
function CharacterName({
  name,
  warnings,
  onEdit,
}: {
  name: string;
  warnings: string[];
  /** 없으면 고칠 수 없는 화면이다. 그때는 탭이 곧 펼치기다 */
  onEdit?: () => void;
}) {
  const reveal = useReveal(name, onEdit ? "hold" : "tap");
  const warned = warnings.length > 0;

  return (
    /*
      경고 표시는 이름 양옆에 같은 것이 하나씩 선다. 한쪽에만 두면 그 칸의 이름만
      반대쪽으로 밀려, 여덟 칸의 이름이 저마다 다른 자리에서 시작한다. 표는 같은
      항목이 한 줄에 늘어서는 것으로 읽는 보기라 그 어긋남이 그대로 눈에 걸린다.
      어느 쪽을 눌러도 같은 말풍선이 뜬다.
    */
    <div className="board-name">
      {warned && <WarnBadge warnings={warnings} />}
      {onEdit ? (
        <button
          {...reveal.props}
          type="button"
          onClick={reveal.guard(onEdit)}
          className="board-name-edit truncate"
          title={`${name} — 눌러서 다른 캐릭터로 바꿉니다`}
        >
          {name}
        </button>
      ) : (
        <span {...reveal.props} className="truncate">
          {name}
        </span>
      )}
      {warned && <WarnBadge warnings={warnings} />}
      {reveal.bubble}
    </div>
  );
}

/**
 * 경고 — 이름 옆의 표시와 눌러서 여는 말풍선.
 *
 * 문장을 이름 아래에 그대로 깔면 한 칸이 이름 너비뿐이라 서너 줄로 접히고, 그 줄만
 * 키가 커져 여덟 칸이 어긋난다. 표는 여덟을 한 줄에 놓고 훑는 보기라 줄이 어긋나면
 * 이 보기를 쓰는 이유가 없어진다. 그래서 있다는 것만 아이콘으로 알리고 문장은 눌렀을
 * 때 띄운다. 경고는 막는 것이 아니라 알리는 것이라(CLAUDE.md 3.4) 늘 펼쳐 둘 것도 아니다.
 *
 * 말풍선은 잘린 글자를 펼치는 것과 같은 장치다(Reveal.tsx). 화면 기준(fixed)으로
 * 띄우고, 3초 뒤에 닫히고, 하나가 열리면 나머지는 닫힌다.
 */
function WarnBadge({ warnings }: { warnings: string[] }) {
  const bubble = useBubble();

  return (
    <span className="board-warn">
      <button
        type="button"
        onClick={(e) => bubble.toggle(e.currentTarget)}
        className="board-warn-icon"
        title="경고 보기"
        aria-label="경고 보기"
        aria-expanded={bubble.isOpen}
      >
        <WarnIcon />
      </button>

      {bubble.render(
        warnings.map((warning) => (
          <span key={warning} className="block">
            {warning}
          </span>
        )),
        "danger",
      )}
    </span>
  );
}

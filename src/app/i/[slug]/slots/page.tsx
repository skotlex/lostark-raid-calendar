import { requireInstance } from "@/lib/instance";
import { listSlots } from "@/lib/slots";
import { compareWeekDay, dayNameFull } from "@/lib/week";

import { SlotForm } from "./SlotForm";
import { SlotRow } from "./SlotRow";

export const dynamic = "force-dynamic";

export default async function SlotsPage({ params }: PageProps<"/i/[slug]/slots">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);
  const slots = await listSlots(instance.id);

  const byDay = new Map<number, typeof slots>();
  for (const slot of slots) {
    const list = byDay.get(slot.dayOfWeek);
    if (list) list.push(slot);
    else byDay.set(slot.dayOfWeek, [slot]);
  }
  const days = [...byDay.keys()].sort(compareWeekDay);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">요일표 편집</h1>
        <p className="mt-1 text-sm text-text-dim">
          여기서 만든 슬롯은 매주 그대로 유지된다. 인원만 수요일 오전 6시에 초기화된다.
        </p>
      </div>

      <section className="rounded border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">레이드 추가</h2>
        <SlotForm slug={slug} />
      </section>

      {slots.length === 0 ? (
        <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
          아직 등록된 레이드가 없다. 위에서 추가한다.
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day} className="space-y-2">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                {dayNameFull(day)}
                <span className="text-xs text-text-faint tabular">
                  {byDay.get(day)!.length}
                </span>
              </h2>
              <ul className="space-y-1.5">
                {byDay.get(day)!.map((slot) => (
                  <SlotRow key={slot.id} slug={slug} slot={slot} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

import { requireInstance } from "@/lib/instance";

export const dynamic = "force-dynamic";

// 고정 요일표 편집 화면. 편성표와 함께 다음 단계에서 만든다.
export default async function SlotsPage({ params }: PageProps<"/i/[slug]/slots">) {
  const { slug } = await params;
  await requireInstance(slug);

  return (
    <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
      요일표 편집은 아직 만드는 중이다.
    </div>
  );
}

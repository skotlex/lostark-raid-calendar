import Link from "next/link";

import { requireInstance } from "@/lib/instance";

export const dynamic = "force-dynamic";

// 편성표 본체는 다음 단계에서 만든다. 지금은 탭이 빈 화면으로 떨어지지 않게만 한다.
export default async function BoardPage({ params }: PageProps<"/i/[slug]">) {
  const { slug } = await params;
  await requireInstance(slug);

  return (
    <div className="rounded border border-dashed border-border px-4 py-10 text-center text-sm text-text-dim">
      편성표는 아직 만드는 중이다.
      <br />
      <Link href={`/i/${slug}/characters`} className="text-accent hover:underline">
        캐릭터부터 등록한다
      </Link>
    </div>
  );
}

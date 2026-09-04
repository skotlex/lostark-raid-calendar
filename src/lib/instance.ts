import "server-only";

import { notFound } from "next/navigation";

import { prisma } from "./prisma";

/** 1단계는 인스턴스 하나만 쓴다. 시드가 이 slug로 만든다. */
export const DEFAULT_SLUG = "main";

export interface InstanceView {
  id: string;
  slug: string;
  name: string;
  /** 암호가 걸린 인스턴스인지. 해시 자체는 절대 화면으로 내보내지 않는다 */
  hasPassword: boolean;
}

export async function findInstance(slug: string): Promise<InstanceView | null> {
  const row = await prisma.instance.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, passwordHash: true },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    hasPassword: row.passwordHash !== null,
  };
}

/** 페이지에서 쓰는 형태. 없으면 404로 떨군다. */
export async function requireInstance(slug: string): Promise<InstanceView> {
  const instance = await findInstance(slug);
  if (!instance) notFound();
  return instance;
}

import { redirect } from "next/navigation";

import { DEFAULT_SLUG } from "@/lib/instance";

/**
 * 1단계는 인스턴스가 하나뿐이라 곧장 넘긴다.
 * 여러 길드를 받게 되면 여기가 인스턴스 목록·생성 화면이 된다.
 */
export default function Home() {
  redirect(`/i/${DEFAULT_SLUG}`);
}

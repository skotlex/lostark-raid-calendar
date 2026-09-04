import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 편성 칸 배경으로 쓰는 캐릭터 이미지(CharacterImage)의 출처다.
    // next/image를 거쳐야 lazy loading과 리사이즈가 걸린다.
    remotePatterns: [
      { protocol: "https", hostname: "img-lostark.game.onstove.com" },
      { protocol: "https", hostname: "cdn-lostark.game.onstove.com" },
      { protocol: "https", hostname: "**.game.onstove.com" },
    ],
  },
};

export default nextConfig;

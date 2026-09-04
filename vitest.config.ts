import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * vitest 설정.
 *
 * `server-only`는 기본 진입점이 곧장 던지도록 만들어진 표식 패키지다. 브라우저 번들에
 * 서버 코드가 섞이는 것을 막는 것이 목적인데, 테스트는 애초에 node에서 도니 그 보호가
 * 필요 없다. Next가 서버에서 쓰는 것과 같은 빈 모듈로 바꿔 끼운다.
 */
export default defineConfig({
  resolve: {
    alias: {
      // exports 필드가 서브패스를 막아둬서 파일 경로로 직접 가리킨다.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

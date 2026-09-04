/**
 * 헤더 로고 만들기 — GIF → 애니메이션 WebP.
 *
 *   npm run logo
 *
 * 원본은 assets/에 둔다. public/에 있으면 1MB짜리 GIF가 브라우저로 나갈 수 있다.
 *
 * 로고를 바꿀 때 다시 돌린다. 손으로 하기 어려운 두 가지를 한다.
 *
 * 1. **바깥 배경만 투명하게.** 받은 GIF는 흰 배경이 불투명하게 박혀 있어 다크 모드에서
 *    흰 상자가 그대로 보인다. 그런데 캐릭터 얼굴도 흰색이라 "흰색을 지운다"로는 얼굴에
 *    구멍이 뚫린다. 가장자리에서 안쪽으로 번져 들어가다 외곽선에 막히게 한다.
 *
 * 2. **WebP로.** GIF는 픽셀마다 투명/불투명 둘 중 하나라 곡선 가장자리가 톱니로 남는다.
 *    WebP는 알파를 온전히 담아 어느 배경에서도 깨끗하다. 크기도 훨씬 작다.
 *
 * 3. **빈 여백 잘라내기.** 배경을 지우고 나면 캐릭터 둘레에 투명 여백이 남는다. 그대로
 *    두면 화면에서 로고가 실제보다 작고 한쪽으로 치우쳐 보인다. 다만 프레임마다 따로
 *    자르면 캐릭터가 덜덜 떨리므로, **모든 프레임을 합친 경계**로 한 번에 자른다.
 *
 * 리사이즈는 프레임을 하나씩 줄여 다시 잇는다. 프레임을 세로로 이어 붙인 채 한 번에
 * 줄이면 sharp가 프레임 경계를 잊어버려 결과가 정지 이미지가 된다.
 */
import sharp from "sharp";

const SRC = "assets/logo-source.gif";
const OUT = "public/logo.webp";

/** 표시 크기의 3배. 고해상도 화면에서도 뭉개지지 않는다. */
const OUT_HEIGHT = 128;

/** 배경으로 볼 색의 여유. 배경(254)과 흰 얼굴을 가르는 값이라 키우면 얼굴이 뚫린다. */
const TOLERANCE = 26;

const src = sharp(SRC, { animated: true });
const meta = await src.metadata();
const width = meta.width!;
const pageHeight = meta.pageHeight ?? meta.height!;
const pages = meta.pages ?? 1;

const { data } = await src.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

let cleared = 0;
for (let page = 0; page < pages; page++) {
  const base = page * pageHeight * width * 4;
  const seen = new Uint8Array(width * pageHeight);
  const stack: number[] = [];

  // 기준색은 프레임마다 좌상단에서 새로 읽는다. 미묘하게 다를 수 있다.
  const r0 = data[base]!;
  const g0 = data[base + 1]!;
  const b0 = data[base + 2]!;
  const near = (i: number) =>
    Math.abs(data[i]! - r0) <= TOLERANCE &&
    Math.abs(data[i + 1]! - g0) <= TOLERANCE &&
    Math.abs(data[i + 2]! - b0) <= TOLERANCE;

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= pageHeight) return;
    const p = y * width + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (!near(base + p * 4)) return;
    stack.push(p);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, pageHeight - 1);
  }
  for (let y = 0; y < pageHeight; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length > 0) {
    const p = stack.pop()!;
    data[base + p * 4 + 3] = 0;
    cleared++;
    const x = p % width;
    const y = (p - x) / width;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
}

// 모든 프레임을 통틀어 그림이 있는 범위. 프레임마다 따로 재면 움직임이 잘려 나간다.
let minX = width;
let minY = pageHeight;
let maxX = -1;
let maxY = -1;
for (let page = 0; page < pages; page++) {
  const base = page * pageHeight * width * 4;
  for (let y = 0; y < pageHeight; y++) {
    for (let x = 0; x < width; x++) {
      if (data[base + (y * width + x) * 4 + 3]! === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const cropW = maxX - minX + 1;
const cropH = maxY - minY + 1;

const outHeight = OUT_HEIGHT;
const outWidth = Math.round((cropW / cropH) * outHeight);

const frames: Buffer[] = [];
for (let page = 0; page < pages; page++) {
  const start = page * pageHeight * width * 4;
  const frame = data.subarray(start, start + pageHeight * width * 4);
  frames.push(
    await sharp(frame, { raw: { width, height: pageHeight, channels: 4 } })
      .extract({ left: minX, top: minY, width: cropW, height: cropH })
      .resize({ width: outWidth, height: outHeight, fit: "fill" })
      .raw()
      .toBuffer(),
  );
}

await sharp(Buffer.concat(frames), {
  raw: { width: outWidth, height: outHeight * pages, channels: 4, pageHeight: outHeight },
})
  .webp({ quality: 82, effort: 6, loop: meta.loop ?? 0, delay: meta.delay })
  .toFile(OUT);

const out = await sharp(OUT, { animated: true }).metadata();
console.log(
  `투명 처리 ${((cleared / (width * pageHeight * pages)) * 100).toFixed(1)}% · ` +
    `여백 잘라냄 ${width}x${pageHeight} → ${cropW}x${cropH} · ` +
    `결과 ${out.width}x${out.pageHeight} ${out.pages}프레임`,
);

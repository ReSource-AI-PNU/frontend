/**
 * 홈 화면 아이콘(PWA)을 src/app/icon.svg에서 만든다. 만든 PNG는 저장소에 넣는다(빌드 때 만들지 않는다).
 *   node scripts/make-pwa-icons.mjs
 *
 *  - icon-192.png, icon-512.png: 아이콘 그대로(둥근 사각, 모서리 투명). manifest의 purpose "any"
 *  - maskable-192.png, maskable-512.png: 바탕을 끝까지 채우고 표지를 가운데 안전 영역(지름 80%) 안으로 줄인 것.
 *    안드로이드가 원·둥근 사각으로 잘라도 표지가 잘리지 않는다. purpose "maskable"
 * sharp는 next가 함께 설치하는 이미지 라이브러리다.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src/app/icon.svg"), "utf8");
const out = path.join(root, "public/icons");
mkdirSync(out, { recursive: true });

// 표지(흰 글자 B)만 꺼내 maskable 판을 만든다
const glyph = source.match(/<g\b[\s\S]*<\/g>/)?.[0];
const background = source.match(/<rect[^>]*fill="([^"]+)"/)?.[1];
if (!glyph || !background) throw new Error("icon.svg에서 표지나 바탕색을 찾지 못했습니다");
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${background}"/>${glyph.replace(/scale\(([\d.]+)\)/, "scale(0.6)")}</svg>`;

const jobs = [
  ["icon-192.png", source, 192],
  ["icon-512.png", source, 512],
  ["maskable-192.png", maskable, 192],
  ["maskable-512.png", maskable, 512],
];
for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg), { density: Math.ceil((72 * size) / 32) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, name));
  console.log(`public/icons/${name} ${size}x${size}`);
}

// 브라우저 탭 아이콘과 아이폰 홈 화면 아이콘도 같은 icon.svg에서 만든다(src/app에 둔다: Next가 파일 이름으로 인식한다)
const png = (svg, size) => sharp(Buffer.from(svg), { density: Math.ceil((72 * size) / 32) }).resize(size, size).png({ compressionLevel: 9 });
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${background}"/>${glyph.replace(/scale\(([\d.]+)\)/, "scale(0.7)")}</svg>`;
await png(appleSvg, 180).flatten({ background }).removeAlpha().toFile(path.join(root, "src/app/apple-icon.png"));
console.log("src/app/apple-icon.png 180x180");

// favicon.ico: PNG 두 장(32, 64)을 ICO 그릇에 담는다
const frames = await Promise.all([32, 64].map(async (size) => ({ size, data: await png(source, size).toBuffer() })));
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach(({ size, data }, index) => {
  const at = 6 + 16 * index;
  header.writeUInt8(size, at);
  header.writeUInt8(size, at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(data.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += data.length;
});
writeFileSync(path.join(root, "src/app/favicon.ico"), Buffer.concat([header, ...frames.map((frame) => frame.data)]));
console.log("src/app/favicon.ico 32, 64");

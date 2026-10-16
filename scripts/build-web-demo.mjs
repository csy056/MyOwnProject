// 웹 빌드(dist)로 한 장짜리 데모 페이지를 만든다. (claude.ai Artifact 같은 정적 호스팅용)
// 스크립트 경로를 상대 경로로 바꾸고, 문서 골격 없이 본문만 남긴다.
// 사용법: npx expo export --platform web --output-dir dist && node scripts/build-web-demo.mjs <출력 폴더>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const out = path.resolve(process.argv[2] ?? path.join(root, 'web-demo'));

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="\/([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
if (scripts.length === 0) throw new Error('dist/index.html 에서 스크립트를 찾지 못했습니다. 먼저 웹으로 export 하세요.');

fs.mkdirSync(out, { recursive: true });
const files = {};
// 일부 호스팅은 "_"로 시작하는 경로를 예약하므로 js/ 아래로 옮긴다.
const published = [];
for (const s of scripts) {
  const rel = `js/${path.basename(s)}`;
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(dist, s), dest);
  files[rel] = dest;
  published.push(rel);
}

const page = `<title>경계선</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; background: #0e0f10; color: #e8e4dc; }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<noscript>JavaScript를 켜야 플레이할 수 있습니다.</noscript>
<div id="root"></div>
${published.map((s) => `<script src="${s}" defer></script>`).join('\n')}
`;
fs.writeFileSync(path.join(out, 'index.html'), page);
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 2));
console.log(`데모 페이지: ${path.join(out, 'index.html')} (스크립트 ${scripts.length}개)`);

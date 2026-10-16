// story/*.ink 를 컴파일해 src/story/story.json 으로 저장한다.
// 사용법: node scripts/compile-story.mjs [--check]
//   --check: 파일을 쓰지 않고 오류만 검사한다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler, CompilerOptions } from 'inkjs/full';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storyDir = path.join(root, 'story');
const outFile = path.join(root, 'src', 'story', 'story.json');
// 스토리 내용이 바뀌면 저장 파일을 안전하게 옮기기 위한 버전 (내용 해시)
const versionFile = path.join(root, 'src', 'story', 'version.json');
const checkOnly = process.argv.includes('--check');

const fileHandler = {
  ResolveInkFilename: (filename) => path.join(storyDir, filename),
  LoadInkFileContents: (filename) => fs.readFileSync(filename, 'utf8'),
};

const errors = [];
const warnings = [];
const errorHandler = (message, type) => {
  // ErrorType: 0 = Author(TODO), 1 = Warning, 2 = Error
  if (type === 2) errors.push(message);
  else if (type === 1) warnings.push(message);
};

// countAllVisits: 모든 노트의 방문 횟수를 저장한다. (스토리가 바뀐 저장을 옮길 때 허브 도착 여부를 본다)
const options = new CompilerOptions('main.ink', [], true, errorHandler, fileHandler);
const source = fs.readFileSync(path.join(storyDir, 'main.ink'), 'utf8');
const compiler = new Compiler(source, options);

let story = null;
try {
  story = compiler.Compile();
} catch (e) {
  if (errors.length === 0) errors.push(String(e && e.message ? e.message : e));
}

for (const w of warnings) console.warn('경고:', w);
for (const e of errors) console.error('오류:', e);

if (errors.length > 0 || !story) {
  console.error(`\n컴파일 실패: 오류 ${errors.length}개`);
  process.exit(1);
}

const json = story.ToJson();
if (!checkOnly) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, json);
  const version = crypto.createHash('sha1').update(json).digest('hex').slice(0, 12);
  fs.writeFileSync(versionFile, JSON.stringify({ version }) + '\n');
  console.log(`컴파일 성공: ${path.relative(root, outFile)} (${(json.length / 1024).toFixed(1)} KB, 경고 ${warnings.length}개)`);
} else {
  console.log(`검사 통과 (경고 ${warnings.length}개)`);
}

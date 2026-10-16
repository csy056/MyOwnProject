// 스토리 자동 플레이 검사기.
// 무작위 선택으로 여러 번 끝까지 플레이하며 막힌 곳, 도달하지 못한 엔딩, 미완성 문구, 수치 이상을 찾는다.
// 사용법: node scripts/playtest.mjs [플레이 횟수=1500] [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Story } from 'inkjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = fs.readFileSync(path.join(root, 'src', 'story', 'story.json'), 'utf8');
const runs = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 1500);
const verbose = process.argv.includes('--verbose');

const ENDINGS = ['escape', 'stay', 'truth_erase', 'truth_redraw', 'truth_self', 'death', 'erased'];
const AREAS = [
  { dome: '서울', area: '종로구', kind: 'metro', coastal: false, key: 'seoul_jongno' },
  { dome: '서울', area: '마포구', kind: 'metro', coastal: false, key: 'seoul_mapo' },
  { dome: '서울', area: '영등포구', kind: 'metro', coastal: false, key: 'seoul_yeongdeungpo' },
  { dome: '서울', area: '송파구', kind: 'metro', coastal: false, key: 'seoul_songpa' },
  { dome: '부산', area: '해운대구', kind: 'metro', coastal: true, key: 'busan_haeundae' },
  { dome: '대전', area: '유성구', kind: 'metro', coastal: false, key: 'daejeon_yuseong' },
  { dome: '서울', area: '노원구', kind: 'metro', coastal: false, key: '' },
  { dome: '수원시', area: '수원시', kind: 'city', coastal: false, key: '' },
  { dome: '포항시', area: '포항시', kind: 'city', coastal: true, key: '' },
  { dome: '양평군', area: '양평군', kind: 'county', coastal: false, key: '' },
  { dome: '완도군', area: '완도군', kind: 'county', coastal: true, key: '' },
];

// 한국어 조사 (앱의 src/story/josa.ts 와 같은 규칙)
function josa(word, kind) {
  const w = String(word);
  const last = w.charCodeAt(w.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const jong = isHangul ? (last - 0xac00) % 28 : 0;
  const has = jong !== 0;
  switch (kind) {
    case 'eun': return w + (has ? '은' : '는');
    case 'i': return w + (has ? '이' : '가');
    case 'eul': return w + (has ? '을' : '를');
    case 'wa': return w + (has ? '과' : '와');
    case 'ro': return w + (has && jong !== 8 ? '으로' : '로');
    case 'a': return w + (has ? '아' : '야');
    default: return w;
  }
}

const problems = new Map(); // 문제 메시지 -> 횟수
function problem(msg) {
  problems.set(msg, (problems.get(msg) ?? 0) + 1);
}

const endingCount = Object.fromEntries(ENDINGS.map((e) => [e, 0]));
const chapterReached = new Array(9).fill(0);
const knotsSeen = new Set();
let totalSteps = 0;
let timeouts = 0;
let maxSceneParagraphs = 0;

function rand(n) {
  return Math.floor(Math.random() * n);
}

for (let i = 0; i < runs; i++) {
  const story = new Story(json);
  story.BindExternalFunction('josa', josa, true);
  const a = AREAS[rand(AREAS.length)];
  const vs = story.variablesState;
  vs.$('route', Math.random() < 0.3 ? 'outsider' : 'survivor');
  vs.$('dome_name', a.dome);
  vs.$('area_name', a.area);
  vs.$('area_kind', a.kind);
  vs.$('coastal', a.coastal);
  vs.$('area_key', a.key);
  const runner = Math.random() < 0.5; // 절반은 러닝을 하는 플레이어로 가정
  let ended = null;
  let steps = 0;
  let sceneParagraphs = 0;

  while (steps < 600) {
    vs.$('is_night', Math.random() < 0.35);
    while (story.canContinue) {
      let text;
      try {
        text = story.Continue();
      } catch (e) {
        problem(`런타임 예외: ${e.message}`);
        break;
      }
      const tags = story.currentTags ?? [];
      if (tags.includes('CLEAR')) sceneParagraphs = 0;
      if (text.trim()) sceneParagraphs++;
      maxSceneParagraphs = Math.max(maxSceneParagraphs, sceneParagraphs);
      if (text.includes('작성 예정')) problem(`미완성 문구: ${text.trim().slice(0, 60)}`);
      if (/\{|\}|undefined|NaN|\[object/.test(text)) problem(`출력 이상: ${text.trim().slice(0, 80)}`);
      for (const t of tags) {
        const m = /^ENDING:\s*(\w+)/.exec(t);
        if (m) ended = m[1];
      }
    }
    if (story.state.currentErrors && story.state.currentErrors.length) {
      problem(`스토리 오류: ${story.state.currentErrors.join(' / ')}`);
      break;
    }
    const hp = vs.$('hp');
    const mind = vs.$('mind');
    if (hp < 0 || hp > 10 || mind < 0 || mind > 10) problem(`수치 범위 이상: hp=${hp} mind=${mind}`);
    if (vs.$('food') < 0 || vs.$('parts') < 0) problem('식량/부품 음수');
    chapterReached[vs.$('chapter')]++;

    const choices = story.currentChoices;
    if (choices.length === 0) {
      if (!ended) problem('막힘: 선택지도 엔딩도 없이 끝남');
      break;
    }
    for (const c of choices) {
      if (!c.text.trim()) problem('빈 선택지');
      if (c.text.length > 24) problem(`긴 선택지(${c.text.length}자): ${c.text}`);
    }
    // 러닝 플레이어는 가끔 원정을 다녀온 것으로 시뮬레이션한다.
    if (runner && Math.random() < 0.15 && !vs.$('pending_debrief')) {
      const km = Math.round((1 + Math.random() * 9) * 10) / 10;
      const cells = Math.floor(km * (6 + Math.random() * 8));
      const loop = Math.random() < 0.4;
      vs.$('pending_debrief', true);
      vs.$('last_run_km', km);
      vs.$('last_run_cells', cells);
      vs.$('last_run_loop', loop);
      vs.$('run_count', vs.$('run_count') + 1);
      vs.$('run_km_total', Math.round((vs.$('run_km_total') + km) * 10) / 10);
      vs.$('cells_total', vs.$('cells_total') + cells);
      if (loop) vs.$('loops_total', vs.$('loops_total') + 1);
      vs.$('food', vs.$('food') + 1);
      vs.$('parts', vs.$('parts') + 1);
    }
    // 허브에서는 메인 스토리를 조금 더 자주 고르게 해서 엔딩까지 가는 플레이를 늘린다.
    let idx = rand(choices.length);
    const mainIdx = choices.findIndex((c) => c.text.includes('이야기를 따라간다'));
    if (mainIdx >= 0 && Math.random() < 0.45) idx = mainIdx;
    try {
      story.ChooseChoiceIndex(idx);
    } catch (e) {
      problem(`선택 예외: ${e.message}`);
      break;
    }
    knotsSeen.add(story.state.currentPathString?.split('.')[0]);
    steps++;
  }
  totalSteps += steps;
  if (ended) endingCount[ended] = (endingCount[ended] ?? 0) + 1;
  else if (steps >= 600) timeouts++;
  if (verbose && i < 3) console.log(`#${i} ${a.area} ${vs.$('route')} -> ${ended ?? '진행 중'} (${steps}회 선택)`);
}

console.log(`\n자동 플레이 ${runs}회, 평균 선택 ${Math.round(totalSteps / runs)}회, 엔딩 미도달 ${timeouts}회`);
console.log('엔딩 분포:', endingCount);
console.log('한 장면 최대 문단 수:', maxSceneParagraphs);
const missing = ENDINGS.filter((e) => endingCount[e] === 0);
if (missing.length) console.log('도달하지 못한 엔딩:', missing.join(', '));
if (problems.size) {
  console.log(`\n문제 ${problems.size}종:`);
  for (const [m, n] of [...problems.entries()].sort((x, y) => y[1] - x[1]).slice(0, 60)) console.log(`  [${n}회] ${m}`);
}
const hardFail = [...problems.keys()].some((m) => /예외|오류|막힘|출력 이상|수치 범위|음수/.test(m));
process.exit(hardFail ? 1 : 0);

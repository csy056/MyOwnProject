// 터미널에서 스토리를 한 단계씩 플레이한다. (기획 검토, 플레이테스트용)
// 상태는 --save 파일에 저장되므로 명령을 나눠 실행해도 이어진다.
//
//   node scripts/play-cli.mjs new --save /tmp/p.json [--route survivor|outsider] [--dome 서울] [--area 마포구]
//                                  [--kind metro|city|county] [--coastal] [--key seoul_mapo] [--night]
//   node scripts/play-cli.mjs choose <번호> --save /tmp/p.json [--night]
//   node scripts/play-cli.mjs run --save /tmp/p.json --km 5.2 [--cells 30] [--loop] [--pace 330]
//   node scripts/play-cli.mjs status --save /tmp/p.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Story } from 'inkjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = fs.readFileSync(path.join(root, 'src', 'story', 'story.json'), 'utf8');

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const savePath = opt('save');
if (!savePath || savePath === true) {
  console.error('--save <파일> 이 필요합니다.');
  process.exit(1);
}

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

function makeStory() {
  const s = new Story(json);
  s.BindExternalFunction('josa', josa, true);
  return s;
}

const STATS = ['day', 'hp', 'mind', 'food', 'parts', 'trust', 'clues', 'chapter'];
function statLine(s) {
  const v = (k) => s.variablesState.$(k);
  return `[${v('day')}일째] 체력 ${v('hp')}/10 · 정신 ${v('mind')}/10 · 식량 ${v('food')} · 부품 ${v('parts')} · 신뢰 ${v('trust')} · 단서 ${v('clues')} · 장 ${v('chapter')}/8`;
}

function printOut(s, before) {
  s.variablesState.$('is_night', !!opt('night', false));
  const out = [];
  while (s.canContinue) {
    const text = s.Continue().trim();
    const tags = s.currentTags ?? [];
    for (const t of tags) {
      if (t.trim() === 'CLEAR') out.push('\n────────');
      else if (t.startsWith('TITLE:')) out.push(`【${t.slice(6).trim()}】`);
      else if (t.startsWith('CLUE:')) out.push(`  ◆ 단서 기록: ${t.slice(5).trim()}`);
      else if (t.startsWith('ENDING:')) out.push(`  ★ 엔딩: ${t.slice(7).trim()}`);
    }
    if (text) out.push(text);
  }
  console.log(out.join('\n'));
  if (before) {
    const deltas = STATS.filter((k) => k !== 'day' && k !== 'chapter').map((k) => [k, s.variablesState.$(k) - before[k]]).filter(([, d]) => d !== 0);
    if (deltas.length) console.log(`\n(변화: ${deltas.map(([k, d]) => `${k} ${d > 0 ? '+' : ''}${d}`).join(', ')})`);
  }
  console.log('\n' + statLine(s));
  if (s.currentChoices.length === 0) console.log('\n=== 이야기 끝 ===');
  else s.currentChoices.forEach((c, i) => console.log(`  ${i}. ${c.text}`));
}

function snapshot(s) {
  return Object.fromEntries(STATS.map((k) => [k, s.variablesState.$(k)]));
}

const s = makeStory();
if (cmd === 'new') {
  s.variablesState.$('route', opt('route', 'survivor'));
  s.variablesState.$('dome_name', opt('dome', '서울'));
  s.variablesState.$('area_name', opt('area', '마포구'));
  s.variablesState.$('area_kind', opt('kind', 'metro'));
  s.variablesState.$('coastal', !!opt('coastal', false));
  s.variablesState.$('area_key', opt('key', '') === true ? '' : opt('key', ''));
  printOut(s);
} else {
  s.state.LoadJson(fs.readFileSync(savePath, 'utf8'));
  if (cmd === 'choose') {
    const n = Number(args[1]);
    if (!Number.isInteger(n) || n < 0 || n >= s.currentChoices.length) {
      console.error(`선택 번호는 0~${s.currentChoices.length - 1} 사이여야 합니다.`);
      process.exit(1);
    }
    const before = snapshot(s);
    console.log(`> ${s.currentChoices[n].text}\n`);
    s.ChooseChoiceIndex(n);
    printOut(s, before);
  } else if (cmd === 'run') {
    // 실제 러닝을 다녀온 것처럼 원정 결과를 넣는다. 허브에서 "원정 보고"가 생긴다.
    const km = Number(opt('km', 3));
    const v = s.variablesState;
    v.$('pending_debrief', true);
    v.$('last_run_km', km);
    v.$('last_run_cells', Number(opt('cells', Math.round(km * 9))));
    v.$('last_run_loop', !!opt('loop', false));
    v.$('last_run_pace_sec', Number(opt('pace', 360)));
    v.$('run_count', v.$('run_count') + 1);
    v.$('run_km_total', Math.round((v.$('run_km_total') + km) * 10) / 10);
    v.$('cells_total', v.$('cells_total') + Number(opt('cells', Math.round(km * 9))));
    if (opt('loop', false)) v.$('loops_total', v.$('loops_total') + 1);
    v.$('food', v.$('food') + Math.min(3, 1 + Math.floor(km / 2)));
    console.log(`(원정 결과 반영: ${km}km. 허브에 돌아가면 "원정 보고를 한다"가 생긴다. 허브에 있다면 hub 명령으로 다시 그린다)`);
    console.log(statLine(s));
  } else if (cmd === 'hub') {
    s.ChoosePathString('hub');
    printOut(s);
  } else if (cmd === 'status') {
    console.log(statLine(s));
    s.currentChoices.forEach((c, i) => console.log(`  ${i}. ${c.text}`));
  } else {
    console.error('명령: new | choose <n> | run | hub | status');
    process.exit(1);
  }
}
fs.writeFileSync(savePath, s.state.ToJson());

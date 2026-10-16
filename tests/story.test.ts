/// <reference types="jest" />
import storyJson from '@/story/story.json';
import { StoryEngine } from '@/engine/storyEngine';

function newEngine() {
  const e = new StoryEngine(storyJson as unknown as Record<string, unknown>);
  e.setVars({ route: 'survivor', dome_name: '서울', area_name: '마포구', area_kind: 'metro', coastal: false, area_key: 'seoul_mapo' });
  return e;
}

describe('스토리 엔진', () => {
  test('시작하면 화면과 선택지가 나온다', () => {
    const e = newEngine();
    const step = e.advance();
    expect(step.pages.length).toBeGreaterThan(0);
    expect(step.choices.length).toBeGreaterThan(0);
    expect(step.ended).toBe(false);
    expect(e.errors).toEqual([]);
  });

  test('저장한 상태를 불러오면 같은 선택지가 나온다', () => {
    const e = newEngine();
    const step = e.advance();
    e.choose(step.choices[0].index);
    const step2 = e.advance();
    const saved = e.saveState();
    const e2 = newEngine();
    e2.loadState(saved);
    expect(e2.currentChoices().map((c) => c.text)).toEqual(step2.choices.map((c) => c.text));
  });

  test('지명 변수와 조사가 본문에 들어간다', () => {
    const e = newEngine();
    let text = '';
    let step = e.advance();
    for (let i = 0; i < 40 && !step.ended; i++) {
      text += step.pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n');
      if (!step.choices.length) break;
      e.choose(step.choices[0].index);
      step = e.advance();
    }
    expect(text).not.toMatch(/\{|\}|undefined/);
  });

  test('러닝 보고 선택지는 원정 뒤 허브에 나타난다', () => {
    const e = newEngine();
    e.jumpTo('hub');
    expect(e.advance().choices.some((c) => c.text.includes('원정 보고'))).toBe(false);
    e.setVars({ pending_debrief: true, last_run_km: 3.2, last_run_cells: 21, last_run_loop: true, last_run_pace_sec: 330, run_count: 1 });
    e.jumpTo('hub');
    const hub = e.advance();
    const idx = hub.choices.findIndex((c) => c.text.includes('원정 보고'));
    expect(idx).toBeGreaterThanOrEqual(0);
    e.choose(hub.choices[idx].index);
    let step = e.advance();
    expect(step.pages.flatMap((p) => p.lines).length).toBeGreaterThan(0);
    // 보고 안에 선택지가 있으면 허브로 돌아올 때까지 진행한다.
    for (let i = 0; i < 20 && !step.pages.some((p) => p.hub); i++) {
      e.choose(step.choices[0].index);
      step = e.advance();
    }
    expect(step.pages.some((p) => p.hub)).toBe(true);
    expect(e.getVar('pending_debrief')).toBe(false);
  });
});

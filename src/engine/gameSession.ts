import storyJson from '@/story/story.json';
import storyVersion from '@/story/version.json';
import { RADIO_LOGS } from '@/content/radio';
import { isNight } from '@/location/daynight';
import { useGame, type Save, type Screen, type World } from '@/state/store';

import { StoryEngine, type Stats, type Step } from './storyEngine';

// 스토리 엔진 하나를 앱 전체에서 공유한다. 화면은 zustand 저장소의 save.screen 을 그린다.

export const STORY_VERSION: string = (storyVersion as { version: string }).version;

let engine: StoryEngine | null = null;

function createEngine(): StoryEngine {
  return new StoryEngine(storyJson as unknown as Record<string, unknown>);
}

function worldVars(w: World) {
  return {
    route: w.route,
    dome_name: w.dome,
    area_name: w.area,
    area_kind: w.kind,
    coastal: w.coastal,
    area_key: w.key,
  };
}

function stepToScreen(step: Step): Screen {
  return {
    pages: step.pages.length ? step.pages : [{ hub: false, lines: [] }],
    pageIndex: 0,
    choices: step.choices,
    ended: step.ended,
    endingId: step.endingId,
  };
}

function record(step: Step) {
  const store = useGame.getState();
  if (step.clues.length) store.addClues(step.clues);
  if (step.ended && step.endingId) store.markEnding(step.endingId);
}

function advance(e: StoryEngine): Step {
  e.setVar('is_night', isNight());
  const step = e.advance();
  record(step);
  return step;
}

/**
 * 저장된 ink 상태로 엔진을 만든다.
 * 스토리가 바뀌었거나 상태를 읽을 수 없으면 변수(체력, 단서, 장 진행 등)만 옮기고 허브에서 이어 간다.
 * 허브에 도착하기 전(프롤로그 중)이었다면 null.
 */
function loadEngine(inkState: string, version: string | undefined): { engine: StoryEngine; migrated: boolean } | null {
  if (version === STORY_VERSION) {
    try {
      const e = createEngine();
      e.loadState(inkState);
      return { engine: e, migrated: false };
    } catch (err) {
      console.warn('[story] 저장 상태를 불러오지 못해 옮긴다', err);
    }
  }
  try {
    const e = createEngine();
    if (!e.migrateVariablesFrom(inkState)) return null;
    e.jumpTo('hub');
    return { engine: e, migrated: true };
  } catch (err) {
    console.warn('[story] 저장 상태를 옮기지 못했다', err);
    return null;
  }
}

export function getEngine(): StoryEngine | null {
  return engine;
}

export function currentStats(): Stats | null {
  return engine ? engine.stats() : null;
}

/** 허브에서 보여 줄 목표와 경고. 스토리 변수만 읽는다. */
const UPGRADES = [
  { flag: 'up_water', name: '정수기', cost: 3, effect: '매일 체력 +1' },
  { flag: 'up_generator', name: '발전기', cost: 4, effect: '매일 정신 +1' },
  { flag: 'up_barricade', name: '방벽', cost: 5, effect: '밤 습격을 절반 막음' },
] as const;

export function hubHints(): { goal: string; warnings: string[]; next: string | null; build: string | null } | null {
  if (!engine) return null;
  const n = (k: string) => Number(engine!.getVar(k)) || 0;
  const chapter = n('chapter');
  const day = n('day');
  const nextDay = n('next_chapter_day');
  const clues = n('clues');
  let goal: string;
  if (chapter >= 8) goal = '이야기의 끝이 가깝다.';
  else if (chapter === 3 && clues < 2) goal = `다음 이야기를 열려면 단서가 더 필요하다. (${clues}/2) 탐색하고 거점 사람들과 이야기하라.`;
  else if (chapter === 6 && clues < 4) goal = `다음 이야기를 열려면 단서가 더 필요하다. (${clues}/4) 탐색하고 거점 사람들과 이야기하라.`;
  else if (day < nextDay) goal = `다음 이야기까지 ${nextDay - day}일. 그동안 탐색하고, 거점을 돌보고, 달려라.`;
  else goal = `${chapter + 1}장을 따라갈 수 있다.`;
  const warnings: string[] = [];
  if (engine.getVar('pending_debrief') === true) warnings.push('보고하지 않은 원정이 있다. 먼저 "원정 보고를 한다"를 고르라.');
  if (n('food') <= 0) warnings.push('식량이 없다. 이대로 하루가 지나면 체력이 깎인다. 탐색하거나 달려서 보급하라.');
  else if (n('food') === 1) warnings.push('식량이 하루치 남았다.');
  if (n('hp') <= 3) warnings.push('체력이 낮다. 쉬거나 거점을 강화하라.');
  if (n('mind') <= 3) warnings.push('정신이 흔들린다. 쉬거나 사람들과 이야기하라.');
  // 아직 짓지 않은 거점 강화와 비용 ("거점을 돌본다"에서 짓는다)
  const left = UPGRADES.filter((u) => engine!.getVar(u.flag) !== true);
  const parts = n('parts');
  const build = left.length
    ? `거점 강화 (부품 ${parts}개 보유): ${left.map((u) => `${u.name} ${u.cost}개 · ${u.effect}${parts >= u.cost ? ' (가능)' : ''}`).join(' / ')}`
    : null;
  return { goal, warnings, next: nextRunMilestone(), build };
}

/** 다음 러닝 이정표(무전 해금)까지의 진행도. 러닝을 한 번도 안 했으면 첫 원정을 권한다. */
function nextRunMilestone(): string | null {
  const t = useGame.getState().totals;
  const label = { runs: '원정', km: '누적', loops: '포위', cells: '블록' } as const;
  const unit = { runs: '회', km: 'km', loops: '회', cells: '칸' } as const;
  const next = RADIO_LOGS.find((r) => t[r.condition.kind] < r.condition.atLeast);
  if (!next) return null;
  const k = next.condition.kind;
  const have = k === 'km' ? t.km.toFixed(1) : String(t[k]);
  return `다음 무전까지: ${label[k]} ${have}/${next.condition.atLeast}${unit[k]}`;
}

/** 새 게임을 시작한다. */
export function startNewGame(world: World) {
  const e = createEngine();
  e.setVars(worldVars(world));
  const step = advance(e);
  engine = e;
  const save: Save = { inkState: e.saveState(), storyVersion: STORY_VERSION, screen: stepToScreen(step), startedAt: Date.now() };
  useGame.getState().setSave(save);
  applyPendingRun();
}

/** 저장된 게임을 엔진에 불러온다. 이미 불러왔으면 그대로 쓴다. 절대 예외를 던지지 않는다. */
export function ensureLoaded(): boolean {
  const { save, world } = useGame.getState();
  if (!save || !world) return false;
  if (engine) return true;
  const loaded = loadEngine(save.inkState, save.storyVersion);
  if (!loaded) {
    // 프롤로그 도중의 저장인데 스토리가 바뀌었다. 같은 구역에서 처음부터 다시 시작한다.
    startNewGame(world);
    return true;
  }
  const e = loaded.engine;
  // 위치 정보는 저장 이후 바뀌었을 수 있으므로 다시 넣는다. (시작 구역은 게임 동안 유지)
  e.setVars(worldVars(world));
  engine = e;
  if (loaded.migrated) {
    const step = advance(e);
    useGame.getState().setSave({ ...save, inkState: e.saveState(), storyVersion: STORY_VERSION, screen: stepToScreen(step), rewind: undefined });
  }
  applyPendingRun();
  return true;
}

export function unloadEngine() {
  engine = null;
}

function persist(screen: Screen, rewind?: Save['rewind']) {
  const store = useGame.getState();
  if (!engine || !store.save) return;
  store.setSave({
    ...store.save,
    inkState: engine.saveState(),
    storyVersion: STORY_VERSION,
    screen,
    rewind: rewind ?? store.save.rewind,
  });
}

/**
 * 화면의 마지막 장이 허브라면 허브를 다시 그려 새 선택지(원정 보고 등)를 반영한다.
 * 허브 선택지는 허브에 도착한 순간 계산되므로, 그 뒤에 바뀐 앱 변수는 다시 그려야 보인다.
 * 아직 읽지 않은 앞 장들은 그대로 둔다.
 */
function refreshHubIfIdle() {
  const store = useGame.getState();
  const screen = store.save?.screen;
  if (!engine || !screen || screen.ended) return;
  const last = screen.pages[screen.pages.length - 1];
  if (!last?.hub) return;
  engine.jumpTo('hub');
  const step = advance(engine);
  const pages = [...screen.pages.slice(0, -1), ...step.pages];
  persist({ ...stepToScreen(step), pages, pageIndex: Math.min(screen.pageIndex, pages.length - 1) });
}

function gameEnded(): boolean {
  return !!useGame.getState().save?.screen.ended;
}

/** 러닝 결과를 스토리 변수에 반영한다. 보고는 다음 허브에서 할 수 있다. */
export function applyPendingRun() {
  if (!engine) return;
  const store = useGame.getState();
  const t = store.totals;
  engine.setVars({
    run_count: t.runs,
    run_km_total: t.km,
    cells_total: t.cells,
    loops_total: t.loops,
  });
  // 끝난 게임에는 보급을 넣지 않는다. 되감기나 새 게임에서 반영된다.
  if (gameEnded()) return;
  const p = store.consumePendingRun();
  if (!p) return;
  engine.setVars({
    pending_debrief: true,
    last_run_km: p.km,
    last_run_cells: p.newCells,
    last_run_loop: p.loop,
    last_run_pace_sec: p.paceSec,
    food: Number(engine.getVar('food')) + p.food,
    parts: Number(engine.getVar('parts')) + p.parts,
  });
  persist(useGame.getState().save!.screen);
  refreshHubIfIdle();
}

/** 다른 구역을 발견했을 때 부품 1개를 준다. (L3) */
export function grantDiscoveryReward() {
  if (!engine || gameEnded()) return;
  engine.setVar('parts', Number(engine.getVar('parts')) + 1);
  const save = useGame.getState().save;
  if (save) persist(save.screen);
}

export function nextPage() {
  const save = useGame.getState().save;
  if (!save) return;
  const s = save.screen;
  if (s.pageIndex < s.pages.length - 1) persist({ ...s, pageIndex: s.pageIndex + 1 });
}

export function choose(index: number) {
  const store = useGame.getState();
  if (!engine || !store.save) return;
  const rewind = { inkState: engine.saveState(), screen: store.save.screen, storyVersion: STORY_VERSION };
  engine.choose(index);
  let step = advance(engine);
  // 체력이나 정신이 바닥난 그 선택에서 바로 엔딩으로 간다.
  // 그래야 되감기가 원인이 된 선택 직전으로 돌아간다. (허브까지 미루면 무관한 선택으로 되감긴다)
  if (!step.ended) {
    const { hp, mind } = engine.stats();
    const fatal = hp <= 0 ? 'ending_death' : mind <= 0 ? 'ending_erased' : null;
    if (fatal) {
      engine.jumpTo(fatal);
      const end = advance(engine);
      step = { ...end, pages: [...step.pages, ...end.pages], clues: [...step.clues, ...end.clues] };
    }
  }
  persist(stepToScreen(step), rewind);
}

/** 마지막 선택 직전으로 되감는다. (보상형 광고 보상) 체력·정신·식량을 조금 채워 준다. */
export function rewindLastChoice(): boolean {
  const store = useGame.getState();
  const rw = store.save?.rewind;
  if (!rw || !store.world) return false;
  if (rw.storyVersion !== STORY_VERSION) return false; // 다른 버전의 스냅숏은 쓰지 않는다
  const e = createEngine();
  try {
    e.loadState(rw.inkState);
  } catch {
    return false;
  }
  e.setVars(worldVars(store.world));
  const clamp = (v: number) => Math.max(0, Math.min(10, v));
  e.setVars({
    hp: clamp(Number(e.getVar('hp')) + 2),
    mind: clamp(Number(e.getVar('mind')) + 2),
    food: Number(e.getVar('food')) + 2,
  });
  engine = e;
  store.setSave({ ...store.save!, inkState: e.saveState(), storyVersion: STORY_VERSION, screen: rw.screen, rewind: undefined });
  // 끝난 게임이라 미뤄 둔 원정 보급이 있으면 이제 반영한다.
  applyPendingRun();
  return true;
}

/**
 * 하루가 지나며 생긴 유지비(식량 소모, 굶주림, 정수기·발전기 효과)를 추정한다.
 * 사건 보상과 섞여 "보상이 사라진" 것처럼 보이지 않도록 따로 표시하는 데 쓴다.
 */
export function dailyUpkeep(before: Stats, after: Stats): Partial<Record<'hp' | 'mind' | 'food', number>> {
  const days = after.day - before.day;
  if (!engine || days <= 0) return {};
  const up: Partial<Record<'hp' | 'mind' | 'food', number>> = {};
  const starving = before.food <= 0 && after.food <= 0;
  if (starving) up.hp = -days;
  else up.food = -days;
  if (engine.getVar('up_water') === true) up.hp = (up.hp ?? 0) + days;
  if (engine.getVar('up_generator') === true) up.mind = (up.mind ?? 0) + days;
  return up;
}

export function abandonGame() {
  engine = null;
  useGame.getState().resetGame();
}

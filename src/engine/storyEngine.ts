import { Story } from 'inkjs';

import { josa } from './josa';

// ink 스토리를 감싸서 "화면(page)" 단위로 내보낸다.
// - # CLEAR 태그가 붙은 줄에서 새 화면이 시작된다.
// - 한 번 진행할 때 화면이 여러 장 나오면 UI가 "계속"으로 한 장씩 넘긴다.

export type Line =
  | { kind: 'text'; text: string }
  | { kind: 'clue'; text: string };

export type Page = {
  title?: string;
  hub: boolean;
  lines: Line[];
};

export type ChoiceView = { index: number; text: string };

export type Step = {
  pages: Page[];
  choices: ChoiceView[];
  ended: boolean;
  endingId?: string;
  clues: { title: string; day: number }[];
};

export type Stats = {
  day: number;
  hp: number;
  mind: number;
  food: number;
  parts: number;
  trust: number;
  clues: number;
  chapter: number;
};

export const STAT_KEYS: (keyof Stats)[] = ['day', 'hp', 'mind', 'food', 'parts', 'trust', 'clues', 'chapter'];

export type InkValue = string | number | boolean;

export type WorldVars = {
  route: 'survivor' | 'outsider';
  dome_name: string;
  area_name: string;
  area_kind: 'metro' | 'city' | 'county';
  coastal: boolean;
  area_key: string;
};

function parseTag(tag: string): { key: string; value: string } {
  const i = tag.indexOf(':');
  if (i < 0) return { key: tag.trim().toUpperCase(), value: '' };
  return { key: tag.slice(0, i).trim().toUpperCase(), value: tag.slice(i + 1).trim() };
}

export class StoryEngine {
  private story: Story;
  readonly errors: string[] = [];

  constructor(storyJson: string | Record<string, unknown>) {
    this.story = typeof storyJson === 'string' ? new Story(storyJson) : new Story(storyJson as Record<string, any>);
    this.story.BindExternalFunction('josa', (word: unknown, kind: unknown) => josa(String(word), String(kind)), true);
    this.story.onError = (message: string) => {
      this.errors.push(message);
      console.warn('[ink]', message);
    };
  }

  setVar(name: string, value: InkValue) {
    this.story.variablesState.$(name, value);
  }

  setVars(vars: Record<string, InkValue>) {
    for (const [k, v] of Object.entries(vars)) this.setVar(k, v);
  }

  getVar(name: string): InkValue {
    return this.story.variablesState.$(name) as InkValue;
  }

  stats(): Stats {
    const s = {} as Stats;
    for (const k of STAT_KEYS) s[k] = Number(this.getVar(k)) || 0;
    return s;
  }

  /** 다음 선택지나 끝까지 진행하고, 그 사이 출력을 화면 단위로 묶어 돌려준다. */
  advance(): Step {
    const pages: Page[] = [];
    const clues: Step['clues'] = [];
    let endingId: string | undefined;
    let page: Page = { hub: false, lines: [] };

    const pushPage = () => {
      if (page.lines.length > 0 || page.title) pages.push(page);
    };

    while (this.story.canContinue) {
      const text = this.story.Continue() ?? '';
      const tags = this.story.currentTags ?? [];
      let clear = false;
      let title: string | undefined;
      let hub = false;
      let clue: string | undefined;
      for (const raw of tags) {
        const { key, value } = parseTag(raw);
        if (key === 'CLEAR') clear = true;
        else if (key === 'TITLE') title = value;
        else if (key === 'HUB') hub = true;
        else if (key === 'CLUE') clue = value;
        else if (key === 'ENDING') endingId = value;
      }
      if (clear || (title && page.lines.length > 0)) {
        pushPage();
        page = { hub: false, lines: [] };
      }
      if (title) page.title = title;
      if (hub) page.hub = true;
      const trimmed = text.trim();
      if (trimmed) page.lines.push({ kind: 'text', text: trimmed });
      if (clue) {
        // 단서를 찾은 그 순간의 날짜로 기록한다. (같은 진행 안에서 하루가 지나갈 수 있다)
        clues.push({ title: clue, day: Number(this.getVar('day')) || 0 });
        page.lines.push({ kind: 'clue', text: clue });
      }
    }
    pushPage();

    const choices = this.story.currentChoices.map((c) => ({ index: c.index, text: c.text.trim() }));
    const ended = choices.length === 0 && !this.story.canContinue;
    return { pages, choices, ended, endingId, clues };
  }

  currentChoices(): ChoiceView[] {
    return this.story.currentChoices.map((c) => ({ index: c.index, text: c.text.trim() }));
  }

  choose(index: number) {
    this.story.ChooseChoiceIndex(index);
  }

  saveState(): string {
    return this.story.state.ToJson();
  }

  loadState(json: string) {
    this.story.state.LoadJson(json);
  }

  /**
   * 다른 버전의 스토리에서 저장한 상태에서 전역 변수만 옮겨 온다. (위치는 옮기지 않는다)
   * 허브에 한 번이라도 도착했던 저장이면 true.
   */
  migrateVariablesFrom(json: string): boolean {
    const old = JSON.parse(json) as { variablesState?: Record<string, unknown>; visitCounts?: Record<string, number> };
    const vars = old.variablesState ?? {};
    for (const [name, raw] of Object.entries(vars)) {
      // ink 저장 형식: 문자열은 "^값", 숫자·불은 그대로. 그 밖(목록, 이동 대상)은 옮기지 않는다.
      let value: InkValue;
      if (typeof raw === 'string') {
        if (!raw.startsWith('^')) continue;
        value = raw.slice(1);
      } else if (typeof raw === 'number' || typeof raw === 'boolean') {
        value = raw;
      } else continue;
      try {
        this.setVar(name, value);
      } catch {
        // 새 스토리에 없는 변수는 버린다.
      }
    }
    return (old.visitCounts?.hub ?? 0) > 0;
  }

  /** 지정한 노트로 바로 이동한다. 디버그·테스트용. */
  jumpTo(path: string) {
    this.story.ChoosePathString(path);
  }
}

// 엔딩 도감용 이름. 스토리의 # ENDING 태그 id 와 같아야 한다.
// line: 공유 카드에 들어가는 대표 문장 (엔딩 본문에서 뽑았다)
export const ENDING_INFO: Record<string, { title: string; hint: string; line?: string }> = {
  escape: { title: '틈', hint: '벽에도 틈은 있다.', line: '아무도 재지 않았고, 그래서 아무도 지우지 않은 땅이다.' },
  stay: { title: '선꾼의 도시', hint: '남기로 한 사람들의 이야기.', line: '이제 이 안에서 지워지는 것은 없다. 매일 저녁 여섯 시, 누군가 문을 열고 나가는 한.' },
  truth_erase: { title: '백지', hint: '단서를 충분히 모아 삼각점에 오르면.', line: '사람들이 길에 새 이름을 붙인다. 고양이 건너는 길. 태민 씨 오르막.' },
  truth_redraw: { title: '하나의 선', hint: '단서를 충분히 모아 삼각점에 오르면.', line: '나라만 한 고리 하나. 그 선을 따라, 처음으로 아무도 지워지지 않는 아침이 온다.' },
  truth_self: { title: '미등록자', hint: '외부인만 볼 수 있다.', line: '넘을 수 없는 선을 따라 달린다. 그 안쪽이 이제 이 발이 재는 땅이다.' },
  death: { title: '끝난 측량', hint: '체력이 다하면.', line: '사람은 가도 숫자는 남아요.' },
  erased: { title: '회색', hint: '정신이 다하면.', line: '스물두 걸음. 돌아서서 스물두 걸음.' },
};

export const ENDING_ORDER = ['escape', 'stay', 'truth_erase', 'truth_redraw', 'truth_self', 'death', 'erased'];

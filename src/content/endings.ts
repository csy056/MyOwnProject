// 엔딩 도감용 이름. 스토리의 # ENDING 태그 id 와 같아야 한다.
export const ENDING_INFO: Record<string, { title: string; hint: string }> = {
  escape: { title: '틈', hint: '벽에도 틈은 있다.' },
  stay: { title: '선꾼의 도시', hint: '남기로 한 사람들의 이야기.' },
  truth_erase: { title: '백지', hint: '단서를 충분히 모아 삼각점에 오르면.' },
  truth_redraw: { title: '하나의 선', hint: '단서를 충분히 모아 삼각점에 오르면.' },
  truth_self: { title: '미등록자', hint: '외부인만 볼 수 있다.' },
  death: { title: '끝난 측량', hint: '체력이 다하면.' },
  erased: { title: '회색', hint: '정신이 다하면.' },
};

export const ENDING_ORDER = ['escape', 'stay', 'truth_erase', 'truth_redraw', 'truth_self', 'death', 'erased'];

// 러닝 공유 카드에 들어가는 강도윤의 한마디. 원정 보고 대사와 같은 말투.
// 거리와 포위 여부로 고른다. 같은 구간 안에서는 날짜로 돌려 쓴다.

const LOOP = ['포위다. 안쪽이 살아났어.', '닫았네. 그 안은 이제 우리 거야.', '한 바퀴 돌아 제자리. 그게 제일 어려운 거야.'];
const SHORT = ['짧아도 선은 선이야. 내일 또.', '신발 신고 문 나서면 반은 뛴 거야.', '숨 안 차게 뛰는 것도 실력이야.'];
const MID = ['숨 고르는 법 알지? 그거면 돼.', '오늘 그은 선, 내일은 더 진해.', '페이스 일정하네. 거짓말 안 하는 다리야.'];
const LONG = ['…좀 하네. 다리 풀고 와.', '그 거리면 회색도 비켜 가.', '물 마셔. 진짜로.'];
const ULTRA = ['…미쳤네. 좋은 뜻으로.', '그 정도면 동네 하나를 혼자 그었어.', '쌤이 봤으면 웃었을 거야.'];

export function doyunQuote(km: number, loop: boolean, seed = new Date().getDate()): string {
  const pool = loop ? LOOP : km >= 10 ? ULTRA : km >= 5 ? LONG : km >= 2 ? MID : SHORT;
  return pool[Math.abs(seed) % pool.length];
}

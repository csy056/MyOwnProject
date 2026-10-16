// 한국어 조사를 단어의 받침에 맞춰 붙인다.
// scripts/playtest.mjs 의 josa 와 같은 규칙을 유지해야 한다.
export type JosaKind = 'eun' | 'i' | 'eul' | 'wa' | 'ro' | 'a';

function finalConsonant(word: string): number {
  const last = word.charCodeAt(word.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) return (last - 0xac00) % 28;
  return 0;
}

export function josa(word: string, kind: string): string {
  const w = String(word ?? '');
  if (!w) return w;
  const jong = finalConsonant(w);
  const has = jong !== 0;
  switch (kind as JosaKind) {
    case 'eun':
      return w + (has ? '은' : '는');
    case 'i':
      return w + (has ? '이' : '가');
    case 'eul':
      return w + (has ? '을' : '를');
    case 'wa':
      return w + (has ? '과' : '와');
    case 'ro':
      // ㄹ 받침(8)은 '로'
      return w + (has && jong !== 8 ? '으로' : '로');
    case 'a':
      return w + (has ? '아' : '야');
    default:
      return w;
  }
}

// 실제 시각으로 낮과 밤을 정한다. (L4)
// 밤: 19시 ~ 다음 날 06시 (기기 현지 시각)
export const NIGHT_START_HOUR = 19;
export const NIGHT_END_HOUR = 6;

export function isNight(date: Date = new Date()): boolean {
  const h = date.getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

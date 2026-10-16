import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import type { CellId } from '@/run/grid';
import { parseCell } from '@/run/grid';

// 공유 문구. 텍스트 게임답게 블록 지도를 문자 그림으로 붙인다.
// 좌표나 실제 지도는 넣지 않는다. (모양만 보이는 축소 그림)

function isCancel(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === 'AbortError';
}

export async function shareText(message: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ text: message });
        return 'shared';
      }
      await Clipboard.setStringAsync(message);
      return 'copied';
    }
    await Share.share({ message });
    return 'shared';
  } catch (e) {
    if (isCancel(e)) return 'cancelled';
    try {
      const ok = await Clipboard.setStringAsync(message);
      return ok === false ? 'failed' : 'copied';
    } catch {
      return 'failed';
    }
  }
}

/** 블록 집합을 최대 width×height 칸의 문자 그림으로 줄여 그린다. */
export function cellsToAscii(cells: CellId[], highlight: Set<CellId> = new Set(), width = 14, height = 8): string {
  if (cells.length === 0) return '';
  const pts = cells.map((c) => ({ id: c, ...parseCell(c) }));
  let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  for (const p of pts) {
    r0 = Math.min(r0, p.row); r1 = Math.max(r1, p.row);
    c0 = Math.min(c0, p.col); c1 = Math.max(c1, p.col);
  }
  const rows = r1 - r0 + 1, cols = c1 - c0 + 1;
  const sy = Math.max(1, Math.ceil(rows / height));
  const sx = Math.max(1, Math.ceil(cols / width));
  const H = Math.ceil(rows / sy), W = Math.ceil(cols / sx);
  const grid: number[][] = Array.from({ length: H }, () => new Array(W).fill(0));
  for (const p of pts) {
    const y = H - 1 - Math.floor((p.row - r0) / sy); // 북쪽이 위
    const x = Math.floor((p.col - c0) / sx);
    grid[y][x] = Math.max(grid[y][x], highlight.has(p.id) ? 2 : 1);
  }
  return grid.map((line) => line.map((v) => (v === 2 ? '■' : v === 1 ? '▣' : '·')).join('')).join('\n');
}

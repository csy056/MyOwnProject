import { Platform } from 'react-native';

// 회색으로 지워져 가는 세계. 색은 "되찾은 것"에만 쓴다.
export const colors = {
  bg: '#0e0f10',
  bgRaised: '#17191b',
  bgSunken: '#08090a',
  line: '#2a2d30',
  text: '#e8e4dc',
  textDim: '#9a968e',
  textFaint: '#5f5c57',
  grey: '#6d7074',
  accent: '#e8a33d', // 되찾은 블록, 선
  accentDim: '#8a6327',
  danger: '#d2553f',
  good: '#7fb069',
  mind: '#8fa7d8',
} as const;

export const fonts = {
  body: Platform.select({ ios: 'AppleSDGothicNeo-Regular', android: 'sans-serif', default: 'system-ui, sans-serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }),
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const textSizes = {
  small: { body: 15, line: 25 },
  normal: { body: 17, line: 28 },
  large: { body: 20, line: 33 },
} as const;

export type TextSize = keyof typeof textSizes;

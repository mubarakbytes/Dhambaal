import { TextStyle, Platform } from 'react-native';

export const FontFamily = {
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  // On web: JetBrains Mono loaded via CSS. On native: use system monospace
  mono: Platform.OS === 'web' ? 'JetBrains Mono' : 'monospace',
} as const;

const monoFont = Platform.OS === 'web' ? 'JetBrains Mono' : 'monospace';

export const Typography = {
  displayLg: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 48,
    lineHeight: 53,
    letterSpacing: -0.96,
  } as TextStyle,

  headlineLg: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    lineHeight: 38,
  } as TextStyle,

  headlineLgMobile: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    lineHeight: 29,
  } as TextStyle,

  titleMd: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    lineHeight: 25,
  } as TextStyle,

  bodyLg: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    lineHeight: 26,
  } as TextStyle,

  bodySm: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
  } as TextStyle,

  labelMono: {
    fontFamily: monoFont,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
  } as TextStyle,

  labelMonoSm: {
    fontFamily: monoFont,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
  } as TextStyle,
} as const;

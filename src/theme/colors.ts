import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Dark Mode Colors (Futuristic-Glassmorphic Dark Theme)
export const DarkColors = {
  // Backgrounds
  background: '#111415',
  surface: '#111415',
  surfaceDim: '#111415',
  surfaceBright: '#373a3b',
  surfaceContainerLowest: '#0c0f10',
  surfaceContainerLow: '#191c1d',
  surfaceContainer: '#1d2021',
  surfaceContainerHigh: '#282a2b',
  surfaceContainerHighest: '#323536',
  surfaceVariant: '#323536',

  // On-Surface
  onSurface: '#e1e3e4',
  onSurfaceVariant: '#c1c7d3',
  inverseSurface: '#e1e3e4',
  inverseOnSurface: '#2e3132',

  // Outline
  outline: '#8b919d',
  outlineVariant: '#414751',

  // Primary (Sky Blue)
  primary: '#a4c8ff',
  onPrimary: '#00315d',
  primaryContainer: '#4d93e7',
  onPrimaryContainer: '#002a52',
  inversePrimary: '#005fad',
  primaryFixed: '#d4e3ff',
  primaryFixedDim: '#a4c8ff',
  onPrimaryFixed: '#001c3a',
  onPrimaryFixedVariant: '#004784',
  surfaceTint: '#a4c8ff',

  // Secondary (Deep Teal)
  secondary: '#94d1d1',
  onSecondary: '#003737',
  secondaryContainer: '#095252',
  onSecondaryContainer: '#86c3c2',
  secondaryFixed: '#b0eeed',
  secondaryFixedDim: '#94d1d1',
  onSecondaryFixed: '#002020',
  onSecondaryFixedVariant: '#044f4f',

  // Tertiary (Green – "Jooge" active status)
  tertiary: '#4ae183',
  onTertiary: '#003919',
  tertiaryContainer: '#00a657',
  onTertiaryContainer: '#003115',
  tertiaryFixed: '#6bfe9c',
  tertiaryFixedDim: '#4ae183',
  onTertiaryFixed: '#00210c',
  onTertiaryFixedVariant: '#005228',

  // Error
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  // Status dots
  statusJooge: '#4ae183',   // Online / Active
  statusMaqane: '#8b919d',  // Offline

  // Glass surfaces (rgba values for inline styles)
  glassPanelBg: 'rgba(255, 255, 255, 0.05)',
  glassPanelBorder: 'rgba(255, 255, 255, 0.15)',
  glassInteractiveBg: 'rgba(164, 200, 255, 0.2)',
  glassOverlayBg: 'rgba(0, 0, 0, 0.6)',

  // App gradient
  gradientStart: '#0c0f10',
  gradientEnd: '#191c1d',

  // Sent message bubble
  sentBubble: '#4d93e7',
  sentBubbleText: '#ffffff',
};

// 2. Light Mode Colors (Premium Minimalistic Light Theme)
export const LightColors = {
  // Backgrounds
  background: '#f4f6f8',
  surface: '#ffffff',
  surfaceDim: '#eaeaea',
  surfaceBright: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f0f2f5',
  surfaceContainer: '#ffffff',
  surfaceContainerHigh: '#e4e6eb',
  surfaceContainerHighest: '#d8dadf',
  surfaceVariant: '#e4e6eb',

  // On-Surface
  onSurface: '#1a1d1e',
  onSurfaceVariant: '#5c6370',
  inverseSurface: '#1a1d1e',
  inverseOnSurface: '#f5f6f7',

  // Outline
  outline: '#858d99',
  outlineVariant: '#ccd0d5',

  // Primary (Premium Royal Blue)
  primary: '#0066cc',
  onPrimary: '#ffffff',
  primaryContainer: '#e1efff',
  onPrimaryContainer: '#003366',
  inversePrimary: '#004488',
  primaryFixed: '#e1efff',
  primaryFixedDim: '#0066cc',
  onPrimaryFixed: '#001a33',
  onPrimaryFixedVariant: '#003366',
  surfaceTint: '#0066cc',

  // Secondary (Muted Teal)
  secondary: '#008080',
  onSecondary: '#ffffff',
  secondaryContainer: '#e0f2f1',
  onSecondaryContainer: '#004d40',
  secondaryFixed: '#e0f2f1',
  secondaryFixedDim: '#008080',
  onSecondaryFixed: '#002020',
  onSecondaryFixedVariant: '#004d40',

  // Tertiary (Fresh Green)
  tertiary: '#22c55e',
  onTertiary: '#ffffff',
  tertiaryContainer: '#dcfce7',
  onTertiaryContainer: '#14532d',
  tertiaryFixed: '#dcfce7',
  tertiaryFixedDim: '#22c55e',
  onTertiaryFixed: '#052e16',
  onTertiaryFixedVariant: '#14532d',

  // Error
  error: '#ff5c5c',
  onError: '#ffffff',
  errorContainer: '#ffe5e5',
  onErrorContainer: '#ff5c5c',

  // Status dots
  statusJooge: '#22c55e',
  statusMaqane: '#858d99',

  // Glass surfaces for Light Mode (Sleek solid white cards for beautiful contrast)
  glassPanelBg: '#ffffff',
  glassPanelBorder: '#e2e8f0',
  glassInteractiveBg: 'rgba(0, 102, 204, 0.08)',
  glassOverlayBg: 'rgba(0, 0, 0, 0.4)',

  // App gradient
  gradientStart: '#f4f6f8',
  gradientEnd: '#eaeaea',

  // Sent message bubble
  sentBubble: '#0066cc',
  sentBubbleText: '#ffffff',
};

// 3. Mutable Live Reference (Initializes with DarkColors)
export const Colors = {
  ...DarkColors
};

// Active theme subscriptions callbacks list
const listeners: (() => void)[] = [];

/**
 * Subscribes a callback to theme changes (called when RootLayout mounts).
 */
export const subscribeTheme = (listener: () => void) => {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
};

/**
 * Programmatically updates the mutable Colors object properties at runtime
 * and notifies all global layout subscribers to trigger a UI re-render.
 */
export const setTheme = (theme: 'dark' | 'light') => {
  const source = theme === 'light' ? LightColors : DarkColors;
  Object.assign(Colors, source);
  // Notify root subscribers
  listeners.forEach(callback => callback());
};

// Auto-hydrate preferences from Storage upon system startup
AsyncStorage.getItem('SETTINGS_THEME')
  .then(val => {
    if (val === 'light') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  })
  .catch(() => {});

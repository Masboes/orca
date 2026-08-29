// Orca mobile design tokens.
//
// The dark palette matches the desktop graphite/dark palette; the light palette
// mirrors it token-for-token so screens never need to know which one is active.
// All screen files should import from here instead of using inline hex values.

export const darkColors = {
  bgBase: '#111111',
  bgPanel: '#1a1a1a',
  bgRaised: '#242424',
  borderSubtle: '#2a2a2a',
  editorSurface: '#1e1e1e',

  textPrimary: '#e0e0e0',
  textSecondary: '#a1a1a1',
  textMuted: '#8c8c8c',

  // Crisp near-white surface for the single primary action on a screen (the
  // worktree FAB). Brighter than textPrimary so it reads as a solid button, not
  // disabled chrome, while staying monochrome (STYLEGUIDE: color is for state).
  surfaceBright: '#f5f5f5',

  accentBlue: '#3b82f6',
  // Text/icon color on a filled accent (accentBlue) button, where the muted
  // textPrimary would lack contrast against the saturated fill.
  onAccent: '#ffffff',

  statusGreen: '#22c55e',
  statusAmber: '#f59e0b',
  statusRed: '#ef4444',
  // Merge CTA fill + its on-fill text, mirroring the desktop ChecksPanel's
  // bg-green-600 "Squash and merge" button (green-600 / white).
  mergeGreen: '#16a34a',
  onMergeGreen: '#ffffff',
  // Merged-PR purple, mirroring the desktop ReviewIcon's purple-400/70 tone.
  statusPurple: '#a78bfa',
  gitDecorationAdded: '#81b88b',
  gitDecorationDeleted: '#c74e39',
  diffAddedBg: 'rgba(129, 184, 139, 0.1)',
  diffDeletedBg: 'rgba(199, 78, 57, 0.11)',

  syntaxComment: '#6a9955',
  syntaxKeyword: '#569cd6',
  syntaxString: '#ce9178',
  syntaxNumber: '#b5cea8',
  syntaxType: '#4ec9b0',
  syntaxFunction: '#dcdcaa',
  syntaxVariable: '#9cdcfe',
  syntaxMeta: '#c586c0',

  // Terminal WebView background (Tokyonight) — separate from app chrome
  terminalBg: '#1a1b26'
} as const

// Every palette exposes exactly the dark palette's tokens, so a screen can read
// any token without checking which theme is active.
export type ThemeColors = Record<keyof typeof darkColors, string>

export type ThemeName = 'light' | 'dark'

// Surfaces invert so bgRaised stays the surface closest to the reader. Status
// and syntax hues darken rather than carry over — the dark tints are picked for
// #111111 and wash out on white. Syntax follows VS Code Light+.
export const lightColors: ThemeColors = {
  bgBase: '#ffffff',
  bgPanel: '#f7f7f7',
  bgRaised: '#ededed',
  borderSubtle: '#d8d8d8',
  editorSurface: '#fbfbfb',

  textPrimary: '#1a1a1a',
  textSecondary: '#4a4a4a',
  textMuted: '#5f5f5f',

  // The dark counterpart is a near-white fill on a dark screen; here the same
  // "solid primary action" role needs a near-black fill instead.
  surfaceBright: '#1a1a1a',

  accentBlue: '#2563eb',
  onAccent: '#ffffff',

  statusGreen: '#15803d',
  statusAmber: '#b45309',
  statusRed: '#dc2626',
  mergeGreen: '#15803d',
  onMergeGreen: '#ffffff',
  statusPurple: '#7c3aed',
  gitDecorationAdded: '#2e7d32',
  gitDecorationDeleted: '#b3261e',
  diffAddedBg: 'rgba(46, 125, 50, 0.12)',
  diffDeletedBg: 'rgba(179, 38, 30, 0.12)',

  syntaxComment: '#008000',
  syntaxKeyword: '#0000ff',
  syntaxString: '#a31515',
  syntaxNumber: '#098658',
  syntaxType: '#267f99',
  syntaxFunction: '#795e26',
  syntaxVariable: '#001080',
  syntaxMeta: '#af00db',

  // The terminal WebView keeps its own Tokyonight scheme in both themes; a
  // terminal that stays dark under a light UI is conventional, and the webview
  // owns a full 16-color ANSI palette that is not expressible in these tokens.
  terminalBg: '#1a1b26'
}

const palettes: Record<ThemeName, ThemeColors> = {
  dark: darkColors,
  light: lightColors
}

export function paletteFor(theme: ThemeName): ThemeColors {
  return palettes[theme]
}

// Resolved here, not in a bootstrap module, because the 97 module-scope
// StyleSheet.create calls that read `colors` capture it on first require — this
// is the only placement guaranteed to run first. Required lazily so the
// node-environment tests (vitest.config.ts, no react-native mock) still load.
function detectColorScheme(): ThemeName {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reactNative = require('react-native') as {
      Appearance?: { getColorScheme?: () => string | null | undefined }
    }
    return reactNative.Appearance?.getColorScheme?.() === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// The theme resolved for this JS session. Because the module-scope stylesheets
// described above capture their colors on first require, an OS theme change
// mid-session is only picked up on the next cold start.
export const activeTheme: ThemeName = detectColorScheme()

export const colors: ThemeColors = paletteFor(activeTheme)

// expo-status-bar's `style` names the *content* color, so a light UI needs the
// dark glyphs and vice versa.
export const statusBarStyle: 'light' | 'dark' = activeTheme === 'light' ? 'dark' : 'light'

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24
} as const

export const radii = {
  row: 6,
  card: 14,
  button: 6,
  input: 6,
  camera: 8
} as const

export const typography = {
  titleSize: 18,
  bodySize: 14,
  metaSize: 12,
  monoFamily: 'monospace' as const
} as const

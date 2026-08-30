import type { RuntimeMobileTerminalTheme } from '../../../src/shared/runtime-types'
import { activeTheme, darkColors, lightColors } from '../theme/mobile-theme'

// Tokyo Night, and its light counterpart Tokyo Night Day — same hue family, so
// the pair reads as one scheme rather than two unrelated themes.
export const DARK_TERMINAL_THEME: RuntimeMobileTerminalTheme['theme'] = {
  background: darkColors.terminalBg,
  foreground: '#c0caf5',
  cursor: '#c0caf5',
  cursorAccent: darkColors.terminalBg,
  selectionBackground: '#33467c',
  selectionForeground: '#c0caf5',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5'
}

export const LIGHT_TERMINAL_THEME: RuntimeMobileTerminalTheme['theme'] = {
  background: lightColors.terminalBg,
  foreground: '#3760bf',
  cursor: '#3760bf',
  cursorAccent: lightColors.terminalBg,
  selectionBackground: '#b6bfe2',
  selectionForeground: '#3760bf',
  black: '#b4b5b9',
  red: '#f52a65',
  green: '#587539',
  yellow: '#8c6c3e',
  blue: '#2e7de9',
  magenta: '#9854f1',
  cyan: '#007197',
  white: '#6172b0',
  brightBlack: '#a1a6c5',
  brightRed: '#f52a65',
  brightGreen: '#587539',
  brightYellow: '#8c6c3e',
  brightBlue: '#2e7de9',
  brightMagenta: '#9854f1',
  brightCyan: '#007197',
  brightWhite: '#3760bf'
}

// The background tracks the app's page colour: in terminal mode the terminal is
// the whole screen, so a dark pane under a light app reads as a bug rather than
// the convention it is when the terminal is one pane among several.
export const DEFAULT_TERMINAL_THEME: RuntimeMobileTerminalTheme['theme'] =
  activeTheme === 'light' ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME

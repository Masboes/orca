import type { RuntimeMobileTerminalTheme } from '../../../src/shared/runtime-types'
import { activeTheme, darkColors, lightColors } from '../theme/mobile-theme'

// Dark keeps Tokyo Night; light mirrors the desktop's Builtin Tango Light, so a
// session rendered on the phone matches the one on the desktop.
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
  // Mirrors the desktop's Builtin Tango Light so a session looks the same on
  // both, only the background follows the app's page colour instead of pure
  // white. Its neutral foreground is the point: a tinted one (Tokyo Night Day
  // tried #3760bf) casts the whole transcript blue, which desktop never does.
  background: lightColors.terminalBg,
  foreground: '#2e3434',
  cursor: '#2e3434',
  cursorAccent: lightColors.terminalBg,
  selectionBackground: '#accef7',
  selectionForeground: '#2e3434',
  black: '#2e3436',
  red: '#cc0000',
  green: '#4e9a06',
  yellow: '#8e7700',
  blue: '#3465a4',
  magenta: '#75507b',
  cyan: '#05727e',
  white: '#6a6a6a',
  brightBlack: '#555753',
  brightRed: '#ef2929',
  brightGreen: '#1b7a1b',
  brightYellow: '#6d5a00',
  brightBlue: '#204a87',
  brightMagenta: '#ad7fa8',
  brightCyan: '#034b50',
  brightWhite: '#3d3d3d'
}

// The background tracks the app's page colour: in terminal mode the terminal is
// the whole screen, so a dark pane under a light app reads as a bug rather than
// the convention it is when the terminal is one pane among several.
export const DEFAULT_TERMINAL_THEME: RuntimeMobileTerminalTheme['theme'] =
  activeTheme === 'light' ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME

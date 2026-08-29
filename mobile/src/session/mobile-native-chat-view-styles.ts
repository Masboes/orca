import { StyleSheet } from 'react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase
  },
  sendError: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs
  },
  sendErrorText: {
    color: colors.statusRed,
    fontSize: typography.metaSize,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.6
  },
  listWrap: {
    flex: 1,
    position: 'relative'
  },
  // Docked over the transcript. `bottom` is set inline from the keyboard inset
  // so it rides above the IME rather than behind it.
  // Transparent: only the composer card itself occludes. Prose stays visible in
  // the gutters around it and is clipped by the card's own edge, which is what
  // leaves half a glyph showing as a line passes under.
  dock: {
    position: 'absolute',
    left: 0,
    right: 0
  },
  listContent: {
    paddingVertical: spacing.sm,
    flexGrow: 1
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: typography.bodySize,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xs
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    textAlign: 'center'
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  loadEarlier: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    minHeight: 36
  },
  loadEarlierText: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    fontWeight: '600'
  }
})

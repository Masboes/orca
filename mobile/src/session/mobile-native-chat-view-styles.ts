import { StyleSheet } from 'react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    paddingHorizontal: spacing.md
  },
  chromeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  stopLabel: {
    color: colors.statusRed,
    fontSize: typography.metaSize,
    fontWeight: '700'
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
  // ~1.5 lines of body text: enough for the dissolve to read as a transition
  // rather than a hard edge, short enough not to eat a whole line of prose.
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30
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
  fabBottom: {
    bottom: spacing.md
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

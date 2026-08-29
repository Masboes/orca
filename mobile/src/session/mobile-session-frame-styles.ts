import { StyleSheet } from 'react-native'

import { colors, spacing, radii, typography } from '../theme/mobile-theme'

export const mobileSessionFrameStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase
  },
  kavInner: {
    flex: 1
  },
  // Master-detail content row below the header chrome (KTD2): the existing content is
  // the flex-1 left child; the dock column (when present on wide) is the right child.
  sessionContentRow: {
    flex: 1,
    flexDirection: 'row'
  },
  sessionContentMain: {
    flex: 1,
    minWidth: 0
  },
  sessionChrome: {
    // Same ground as the page, and no rule beneath it: the transcript's top
    // fade is the transition now, and a hard edge under it reads as a seam the
    // fade is trying to dissolve.
    backgroundColor: colors.bgBase
  },
  sessionTopBar: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  // Centred over the whole bar rather than flexed between the controls: the
  // left holds one button and the right up to three, so a flex child would sit
  // visibly off-centre. The inset clears the controls on both sides.
  sessionTitleCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 132,
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Takes the flow width the title used to occupy, keeping the panel icons
  // pinned right now that the title no longer participates in the row.
  sessionTitleSpacer: {
    flex: 1
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs
  },
  backButtonPressed: {
    backgroundColor: colors.bgRaised
  },
  filesButton: {
    width: 36,
    height: 36,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs
  },
  filesButtonPressed: {
    backgroundColor: colors.bgRaised
  },
  // Selected state for the active docked-panel icon on wide layouts (R2).
  filesButtonActive: {
    backgroundColor: colors.bgRaised
  },
  sessionTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center'
  },
  // Flips the disclosure chevron when the tab strip is showing.
  tabDisclosureOpen: {
    transform: [{ rotate: '180deg' }]
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  sessionMetaText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle
  },
  tabScroll: {
    flex: 1,
    maxHeight: 30
  },
  tabContent: {
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm
  },
  tab: {
    width: 128,
    maxWidth: 128,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabActive: {
    // Neutral grey underline, matching the desktop terminal tab's active
    // indicator (a muted foreground/card mix), not a blue accent.
    borderBottomColor: colors.textSecondary
  },
  tabLabelRow: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  tabText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: 13
  },
  tabTextActive: {
    color: colors.textPrimary
  },
  newTerminalButton: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  newTerminalButtonPressed: {
    backgroundColor: colors.bgRaised
  },
  newTerminalButtonDisabled: {
    opacity: 0.45
  },
  // Divider between the + new-terminal button and the Quick Commands launcher,
  // matching the tab strip's borderSubtle separators.
  tabActionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: colors.borderSubtle
  },
  terminalFrame: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden'
  },
  terminalPane: {
    ...StyleSheet.absoluteFillObject
  },
  terminalPaneHidden: {
    opacity: 0
  },
  terminalWebView: {
    flex: 1
  },
  markdownFrame: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.bgBase
  },
  browserFrame: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.bgBase
  },
  markdownEditor: {
    flex: 1,
    position: 'relative'
  },
  markdownState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md
  },
  markdownError: {
    color: colors.statusRed,
    fontSize: typography.bodySize
  }
})

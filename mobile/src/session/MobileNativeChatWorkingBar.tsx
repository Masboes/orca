import { Pressable, Text, View } from 'react-native'
import { Square } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { styles } from './mobile-native-chat-view-styles'
import { MobileAgentWorkingIndicator } from './MobileAgentWorkingIndicator'

/** Working indicator and Stop, shown only while the agent runs. At rest this
 *  row would be empty chrome, so it does not mount at all. */
export function MobileNativeChatWorkingBar({
  onStop
}: {
  onStop?: () => void
}): React.JSX.Element {
  return (
    <View style={styles.chromeRow}>
      <View style={styles.chromeLeft}>
        <MobileAgentWorkingIndicator />
      </View>
      <Pressable
        style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
        onPress={onStop}
        hitSlop={8}
        accessibilityLabel="Stop the agent"
      >
        <Square size={13} color={colors.statusRed} strokeWidth={2.4} fill={colors.statusRed} />
        <Text style={styles.stopLabel}>Stop</Text>
      </Pressable>
    </View>
  )
}

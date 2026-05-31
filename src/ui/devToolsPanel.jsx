// Developer tools panel: "Force cache" toggle, navigation (back / forward / reload),
// access to the module, and log console display.
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function DevToolsPanel({
  forceCache,
  onToggleForceCache,
  onGoBack,
  onGoForward,
  onReload,
  onOpenMemorization,
  currentUrl,
  debugLogs,
  debugScrollView,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.panel, { bottom: 10 + insets.bottom }]}
    >
      <View style={styles.rowBetween}>
        <Text style={styles.label}>Force cache (offline)</Text>
        <Switch value={forceCache} onValueChange={onToggleForceCache} />
      </View>
      <View style={styles.actionsRow}>
        <DevToolsButton title="Retour" onPress={onGoBack} />
        <DevToolsButton title="Avance" onPress={onGoForward} />
        <DevToolsButton title="Rafraîchir" onPress={onReload} />
        <DevToolsButton title="Mémorisation" onPress={onOpenMemorization} />
      </View>
      <Text style={styles.url} numberOfLines={1}>
        {currentUrl}
      </Text>

      <View style={styles.logsContainer}>
        <ScrollView
          style={styles.logsScroll}
          contentContainerStyle={styles.logsContent}
          ref={debugScrollView}
        >
          {debugLogs.map((log, index) => (
            <Text style={styles.logText} key={index}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const DevToolsButton = ({ title, onPress }) => (
  <Pressable style={styles.buttonPressable} onPress={onPress}>
    <Text style={styles.button}>{title}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  panel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderColor: '#00000040',
    borderWidth: 1,
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 9999,
    boxShadow: '0px 1px 10px #00000040',
    overflow: 'visible',
    borderRadius: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Arial',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  url: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Arial',
  },
  logsContainer: {
    height: 100,
    width: '100%',
    backgroundColor: '#222',
    borderRadius: 6,
    marginBottom: 4,
    marginTop: 12,
  },
  logsScroll: {
    height: '100%',
    flex: 1,
    width: '100%',
  },
  logsContent: {
    padding: 10,
  },
  logText: {
    fontSize: 13,
    width: '100%',
    fontFamily: 'Menlo',
    color: 'white',
  },
  buttonPressable: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  button: {
    fontSize: 17,
    color: '#007AFF',
    fontFamily: 'Arial',
  },
});

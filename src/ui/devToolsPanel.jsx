import { Button, ScrollView, Switch, Text, View } from 'react-native';
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
      style={{
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderColor: '#00000040',
        borderWidth: 1,
        position: 'absolute',
        bottom: 10 + insets.bottom,
        left: 10,
        right: 10,
        zIndex: 9999,
        boxShadow: '0px 1px 10px #00000040',
        overflow: "visible",
        borderRadius: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <Text style={{ fontSize: 14, fontFamily: "Arial" }}>Force cache (offline)</Text>
        <Switch value={forceCache} onValueChange={onToggleForceCache} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 5,
        }}
      >
        <DevToolsButton title="Retour" onPress={onGoBack} />
        <DevToolsButton title="Avance" onPress={onGoForward} />
        <DevToolsButton title="Rafraîchir" onPress={onReload} />
        <DevToolsButton title="Mémorisation" onPress={onOpenMemorization} />
      </View>
      <Text style={{ fontSize: 16, textAlign: 'center', fontFamily: "Arial" }} numberOfLines={1}>
        {currentUrl}
      </Text>

      <View
        style={{
          height: 100,
          width: '100%',
          backgroundColor: '#222',
          borderRadius: 6,
          marginBottom: 4,
          marginTop: 12,
        }}
      >
        <ScrollView
          style={{
            height: '100%',
            flex: 1,
            width: '100%',
          }}
          contentContainerStyle={{
            padding: 10,
          }}
          ref={debugScrollView}
        >
          {debugLogs.map((log, index) => (
            <Text
              style={{
                fontSize: 13,
                width: '100%',
                fontFamily: 'Menlo',
                color: 'white',
              }}
              key={`${log}-${index}`}
            >
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const DevToolsButton = ({ title, onPress }) => (
  <Text
    style={{
      fontSize: 17,
      color: '#007AFF',
      padding: 8,
      fontFamily: "Arial",
    }}
    onPress={onPress}
  >
    {title}
  </Text>
);

export default DevToolsPanel;

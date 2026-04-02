import { Button, ScrollView, Switch, Text, View } from 'react-native';

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
  return (
    <View
      style={{
        width: '100%',
        padding: 10,
        backgroundColor: '#eee',
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
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
        <Text style={{ fontSize: 14 }}>Force cache (offline)</Text>
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
        <Button title="Retour" onPress={onGoBack} />
        <Button title="Avance" onPress={onGoForward} />
        <Button title="Rafraîchir" onPress={onReload} />
        <Button title="Mémorisation" onPress={onOpenMemorization} />
      </View>
      <Text style={{ fontSize: 16, textAlign: 'center' }} numberOfLines={1}>
        {currentUrl}
      </Text>

      <View
        style={{
          height: 100,
          width: '100%',
          backgroundColor: '#222',
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

export default DevToolsPanel;

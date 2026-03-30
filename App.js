import { StatusBar } from 'expo-status-bar';
import { Button, Dimensions, ScrollView, StyleSheet, Text, View, Switch } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import WEBVIEW_CACHE_INJECTION_RAW from './webviewCacheInjection';

const MEMORIZATION_URL = 'https://dev.elea.apps.education.fr/local/memorization/index.php';
const MEMORIZATION_AJAX_URL = 'https://dev.elea.apps.education.fr/local/memorization/ajax/ajax.php';

export default function App() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [debugLogs, setDebugLogs] = useState([]);
  const [forcedCache, setForcedCache] = useState(false);
  const WEBVIEW_CACHE_INJECTION = WEBVIEW_CACHE_INJECTION_RAW
    .replace('\${MEMORIZATION_AJAX_URL}', MEMORIZATION_AJAX_URL)
    .replace('\${FORCED_CACHE}', forcedCache ? 'true' : 'false');

  const debugScrollView = useRef(null);
  const WebViewRef = useRef(null);

  const addDebugLog = (log) => {
    const logText = new Date().toLocaleTimeString() + ' - ' + log;
    setDebugLogs((prevLogs) => [...prevLogs, logText]);
    setTimeout(() => {
      if (debugScrollView.current) {
        debugScrollView.current.scrollToEnd({ animated: true });
      }
    }, 30);
  }

  useEffect(() => {
    setDebugLogs([]);
    addDebugLog('App mounted');
  }, []);

  useEffect(() => {
    if (!WebViewRef.current) return;
    WebViewRef.current.injectJavaScript(`
      window.__memoForceCache = ${forcedCache ? 'true' : 'false'};
      try {
        window.ReactNativeWebView.postMessage('[CACHE] force cache ${forcedCache ? 'enabled' : 'disabled'}');
      } catch (e) {}
      true;
    `);
  }, [forcedCache]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
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
              justifyContent: 'center',
              marginBottom: 5,
            }}
          >
            <Text style={{ fontSize: 16, marginRight: 10, flex: 1 }}>
              Forcer le cache
            </Text>
            <Switch
              value={forcedCache}
              onValueChange={(value) => {
                setForcedCache(value);
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 5,
            }}
          >
            <Button title='Retour' onPress={() => {
              if (WebViewRef.current) {
                WebViewRef.current.goBack();
              }
            }} />
            <Button title='Avance' onPress={() => {
              if (WebViewRef.current) {
                WebViewRef.current.goForward();
              }
            }} />
            <Button title='Rafraîchir' onPress={() => {
              if (WebViewRef.current) {
                WebViewRef.current.reload();
              }
            }} />
            <Button title='Mémorisation' onPress={() => {
              if (WebViewRef.current) {
                WebViewRef.current.injectJavaScript(`
                  window.location.href = '${MEMORIZATION_URL}';
                `);
              }
            }} />
          </View>
          <Text
            style={{ fontSize: 16, textAlign: 'center' }}
            numberOfLines={1}
          >
            {currentUrl}
          </Text>
        </View>
        <WebView
          style={{
            width: Dimensions.get('window').width,
            height: '100%',
          }}
          source={{ uri: MEMORIZATION_URL }}
          injectedJavaScriptBeforeContentLoaded={WEBVIEW_CACHE_INJECTION}
          onNavigationStateChange={(navState) => {
            setCurrentUrl(navState.url);
            addDebugLog('Navigated to: ' + navState.url);
          }}
          onMessage={(event) => {
            if (event?.nativeEvent?.data) {
              addDebugLog(event.nativeEvent.data);
            }
          }}
          ref={WebViewRef}
        />

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
                key={index}
              >
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

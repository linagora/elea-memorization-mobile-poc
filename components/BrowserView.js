import { Button, Dimensions, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWebviewCacheInjection } from '../webviewCacheInjection';
import { createWebviewAutoLoginInjection } from '../webviewAutoLoginInjection';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MEMORIZATION_URL = 'https://dev.elea.apps.education.fr/local/memorization/index.php';
const MEMORIZATION_BASE_URL = 'https://dev.elea.apps.education.fr/';
const MEMORIZATION_OFFLINE_HTML_KEY = '__memo_offline_html_v1__';
const LOGIN_USERNAME = 'student@linagora.com';
const LOGIN_PASSWORD = '***REMOVED***';

export default function BrowserView() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [debugLogs, setDebugLogs] = useState([]);
  const [forceCache, setForceCache] = useState(false);
  const [cachedOfflineHtml, setCachedOfflineHtml] = useState('');
  const [webViewSource, setWebViewSource] = useState({ uri: MEMORIZATION_URL });

  const WEBVIEW_CACHE_INJECTION = createWebviewCacheInjection({
    forceCache,
  });
  const WEBVIEW_AUTO_LOGIN_INJECTION = createWebviewAutoLoginInjection({
    username: LOGIN_USERNAME,
    password: LOGIN_PASSWORD,
  });
  const WEBVIEW_INJECTION = `${WEBVIEW_AUTO_LOGIN_INJECTION}\n${WEBVIEW_CACHE_INJECTION}`;

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
  };

  useEffect(() => {
    setDebugLogs([]);
    addDebugLog('App mounted');
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(MEMORIZATION_OFFLINE_HTML_KEY)
      .then((html) => {
        if (!mounted || !html) return;
        setCachedOfflineHtml(html);
        addDebugLog('[CACHE] Offline snapshot restored');
      })
      .catch(() => {
        addDebugLog('[CACHE] Offline snapshot load failed');
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!WebViewRef.current) return;
    WebViewRef.current.injectJavaScript(`
      window.__memoForceCache = ${forceCache ? 'true' : 'false'};
      true;
    `);
    addDebugLog('[CACHE] Force cache ' + (forceCache ? 'enabled' : 'disabled'));
    if (forceCache && cachedOfflineHtml) {
      setWebViewSource({
        html: cachedOfflineHtml,
        baseUrl: MEMORIZATION_BASE_URL,
      });
      addDebugLog('[CACHE] Loaded offline snapshot');
    }
  }, [forceCache, cachedOfflineHtml]);

  const insets = useSafeAreaInsets();

  const injectedStyleSheet = `
    :root {
      --inj-insets-top: ${insets.top}px;
    }
    .navbar.fixed-top {
        padding-top: var(--inj-insets-top) !important;
        height: calc(75px + var(--inj-insets-top)) !important;
    }
    #page {
        margin-top: calc(75px + var(--inj-insets-top)) !important;
    }
  `;

  return (
    <View style={styles.container}>
      <WebView
        style={{
          width: Dimensions.get('window').width,
          height: '100%',
        }}
        source={webViewSource}
        injectedJavaScriptBeforeContentLoaded={WEBVIEW_INJECTION}
        cacheEnabled
        onNavigationStateChange={(navState) => {
          setCurrentUrl(navState.url);
          addDebugLog('Navigated to: ' + navState.url);
        }}
        onMessage={(event) => {
          const data = event?.nativeEvent?.data;
          if (!data) return;
          if (data.startsWith('[OFFLINE_HTML] ')) {
            const encoded = data.slice('[OFFLINE_HTML] '.length);
            try {
              const html = decodeURIComponent(encoded);
              setCachedOfflineHtml(html);
              AsyncStorage.setItem(MEMORIZATION_OFFLINE_HTML_KEY, html).catch(() => null);
              addDebugLog('[CACHE] Offline snapshot saved');
            } catch (e) {
              addDebugLog('[CACHE] Offline snapshot decode failed');
            }
            return;
          }
          addDebugLog(data);
        }}
        onError={() => {
          if (!cachedOfflineHtml) {
            addDebugLog('[CACHE] No offline snapshot available');
            return;
          }
          setWebViewSource({
            html: cachedOfflineHtml,
            baseUrl: MEMORIZATION_BASE_URL,
          });
          addDebugLog('[CACHE] Network error, fallback to offline snapshot');
        }}
        onLoadEnd={() => {
          if (!WebViewRef.current) return;
          WebViewRef.current.injectJavaScript(`
              let css = \`${injectedStyleSheet}\`; 
              let style = document.createElement('style');
              document.body.appendChild(style);

              style.type = 'text/css';
              if (style.styleSheet){
                style.styleSheet.cssText = css;
              } else {
                style.appendChild(document.createTextNode(css));
              }
            `)
        }}
        ref={WebViewRef}
      />

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
          <Switch
            value={forceCache}
            onValueChange={setForceCache}
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
            setWebViewSource({ uri: MEMORIZATION_URL });
          }} />
        </View>
        <Text
          style={{ fontSize: 16, textAlign: 'center' }}
          numberOfLines={1}
        >
          {currentUrl}
        </Text>
      </View>

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
    </View>
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

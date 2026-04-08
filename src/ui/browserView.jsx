import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  AUTO_LOGIN_ENABLED,
  LOGIN_PASSWORD,
  LOGIN_USERNAME,
  MEMORIZATION_BASE_URL,
  MEMORIZATION_URL,
} from '../browser/config';
import { useDebugLogs, useOfflineSnapshot } from '../browser/hooks';
import { DevToolsPanel } from './devToolsPanel';
import {
  createWebviewAutoLoginInjection,
  createWebviewCacheInjection,
  createWebviewMobileInjection,
} from '../injections/webview';

const OFFLINE_HTML_PREFIX = '[OFFLINE_HTML] ';

export function BrowserView() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);

  const [currentUrl, setCurrentUrl] = useState('');
  const [forceCache, setForceCache] = useState(false);
  const [devToolsVisible, setDevToolsVisible] = useState(false);
  const [webViewSource, setWebViewSource] = useState({ uri: MEMORIZATION_URL });

  const { debugLogs, addDebugLog, clearDebugLogs, debugScrollView } = useDebugLogs();
  const { cachedOfflineHtml, saveOfflineSnapshot } = useOfflineSnapshot(addDebugLog);

  const webviewCacheInjection = useMemo(() => {
    return createWebviewCacheInjection({
      forceCache,
      baseUrl: MEMORIZATION_BASE_URL,
    });
  }, [forceCache]);

  const webviewAutoLoginInjection = useMemo(() => {
    if (!AUTO_LOGIN_ENABLED) {
      return '';
    }

    return createWebviewAutoLoginInjection({
      username: LOGIN_USERNAME,
      password: LOGIN_PASSWORD,
    });
  }, []);

  const webviewMobileInjection = useMemo(() => {
    return createWebviewMobileInjection(insets.top);
  }, [insets.top]);

  const webviewInjection = useMemo(() => {
    return [webviewAutoLoginInjection, webviewCacheInjection, webviewMobileInjection]
      .filter(Boolean)
      .join('\n');
  }, [webviewAutoLoginInjection, webviewCacheInjection, webviewMobileInjection]);

  useEffect(() => {
    clearDebugLogs();
    addDebugLog('App mounted');

    if (!AUTO_LOGIN_ENABLED) {
      addDebugLog('[LOGIN] Auto-login disabled (missing EXPO_PUBLIC_ELEA_LOGIN_USERNAME/PASSWORD)');
    }
  }, [addDebugLog, clearDebugLogs]);

  useEffect(() => {
    if (!webViewRef.current) {
      return;
    }

    webViewRef.current.injectJavaScript(`
      window.__memoForceCache = ${forceCache ? 'true' : 'false'};
      if (window.__memoCacheRuntime && typeof window.__memoCacheRuntime.installOfflineUiHandlers === 'function') {
        window.__memoCacheRuntime.installOfflineUiHandlers();
      }
      if (!window.__memoForceCache && window.__memoCacheRuntime && typeof window.__memoCacheRuntime.syncPendingOfflineSet === 'function') {
        window.__memoCacheRuntime.syncPendingOfflineSet();
        setTimeout(function() {
          if (window.__memoCacheRuntime && typeof window.__memoCacheRuntime.syncPendingOfflineSet === 'function') {
            window.__memoCacheRuntime.syncPendingOfflineSet();
          }
        }, 500);
      }
      true;
    `);

    addDebugLog(`[CACHE] Force cache ${forceCache ? 'enabled' : 'disabled'}`);

    if (!forceCache) {
      setWebViewSource((previousSource) => {
        if (!previousSource || !('html' in previousSource)) {
          return previousSource;
        }

        return { uri: currentUrl || MEMORIZATION_URL };
      });
    }
  }, [addDebugLog, currentUrl, forceCache]);

  const handleOpenMemorization = useCallback(() => {
    setWebViewSource({ uri: MEMORIZATION_URL });
  }, []);

  const handleNavigationStateChange = useCallback(
    (navState) => {
      setCurrentUrl(navState.url);
      addDebugLog(`Navigated to: ${navState.url}`);
    },
    [addDebugLog]
  );

  const handleMessage = useCallback(
    (event) => {
      const data = event?.nativeEvent?.data;
      if (!data) {
        return;
      }

      if (data === '[DEVTOOLS] Toggle dev tools') {
        setDevToolsVisible((visible) => !visible);
        return;
      }

      if (data.startsWith(OFFLINE_HTML_PREFIX)) {
        const encoded = data.slice(OFFLINE_HTML_PREFIX.length);

        try {
          const html = decodeURIComponent(encoded);
          saveOfflineSnapshot(html);
        } catch {
          addDebugLog('[CACHE] Offline snapshot decode failed');
        }

        return;
      }

      addDebugLog(data);
    },
    [addDebugLog, saveOfflineSnapshot]
  );

  const handleError = useCallback(() => {
    if (!cachedOfflineHtml) {
      addDebugLog('[CACHE] No offline snapshot available');
      return;
    }

    setWebViewSource({
      html: cachedOfflineHtml,
      baseUrl: MEMORIZATION_BASE_URL,
    });
    addDebugLog('[CACHE] Network error, fallback to offline snapshot');
  }, [addDebugLog, cachedOfflineHtml]);

  const handleLoadEnd = useCallback(() => {
    if (!webViewRef.current || !webviewInjection) {
      return;
    }

    webViewRef.current.injectJavaScript(webviewInjection);
  }, [webviewInjection]);

  const handleGoBack = useCallback(() => {
    webViewRef.current?.goBack();
  }, []);

  const handleGoForward = useCallback(() => {
    webViewRef.current?.goForward();
  }, []);

  const handleReload = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' translucent />
      <WebView
        style={styles.webview}
        source={webViewSource}
        injectedJavaScriptBeforeContentLoaded={webviewInjection}
        injectedJavaScript={webviewInjection}
        cacheEnabled
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onError={handleError}
        onLoadEnd={handleLoadEnd}
        ref={webViewRef}
        bounce={false}
      />

      {devToolsVisible && (
        <DevToolsPanel
          forceCache={forceCache}
          onToggleForceCache={setForceCache}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onReload={handleReload}
          onOpenMemorization={handleOpenMemorization}
          currentUrl={currentUrl}
          debugLogs={debugLogs}
          debugScrollView={debugScrollView}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    width: '100%',
  },
});

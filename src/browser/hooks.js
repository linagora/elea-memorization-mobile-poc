import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_DEBUG_LOGS, MEMORIZATION_OFFLINE_HTML_KEY } from './config';

export function useDebugLogs() {
  const [debugLogs, setDebugLogs] = useState([]);
  const debugScrollView = useRef(null);

  const addDebugLog = useCallback((message) => {
    const logText = `${new Date().toLocaleTimeString()} - ${message}`;
    setDebugLogs((prevLogs) => [...prevLogs.slice(-(MAX_DEBUG_LOGS - 1)), logText]);

    setTimeout(() => {
      if (debugScrollView.current) {
        debugScrollView.current.scrollToEnd({ animated: true });
      }
    }, 30);
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  return {
    debugLogs,
    addDebugLog,
    clearDebugLogs,
    debugScrollView,
  };
}

export function useOfflineSnapshot(addDebugLog) {
  const [cachedOfflineHtml, setCachedOfflineHtml] = useState('');

  useEffect(() => {
    let mounted = true;

    const restoreOfflineSnapshot = async () => {
      try {
        const html = await AsyncStorage.getItem(MEMORIZATION_OFFLINE_HTML_KEY);
        if (!mounted || !html) {
          return;
        }

        setCachedOfflineHtml(html);
        addDebugLog('[CACHE] Offline snapshot restored');
      } catch {
        addDebugLog('[CACHE] Offline snapshot load failed');
      }
    };

    restoreOfflineSnapshot();

    return () => {
      mounted = false;
    };
  }, [addDebugLog]);

  const saveOfflineSnapshot = useCallback(
    async (html) => {
      setCachedOfflineHtml(html);

      try {
        await AsyncStorage.setItem(MEMORIZATION_OFFLINE_HTML_KEY, html);
        addDebugLog('[CACHE] Offline snapshot saved');
        return true;
      } catch {
        addDebugLog('[CACHE] Offline snapshot save failed');
        return false;
      }
    },
    [addDebugLog]
  );

  return {
    cachedOfflineHtml,
    saveOfflineSnapshot,
  };
}

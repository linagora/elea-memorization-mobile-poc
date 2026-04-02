import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MEMORIZATION_OFFLINE_HTML_KEY } from './constants';

export function useOfflineSnapshot(addDebugLog) {
  const [cachedOfflineHtml, setCachedOfflineHtml] = useState('');

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(MEMORIZATION_OFFLINE_HTML_KEY)
      .then((html) => {
        if (!mounted || !html) {
          return;
        }

        setCachedOfflineHtml(html);
        addDebugLog('[CACHE] Offline snapshot restored');
      })
      .catch(() => {
        addDebugLog('[CACHE] Offline snapshot load failed');
      });

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

export default useOfflineSnapshot;

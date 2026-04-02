import { useCallback, useRef, useState } from 'react';
import { MAX_DEBUG_LOGS } from './constants';

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

export default useDebugLogs;

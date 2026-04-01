import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BrowserView from './components/BrowserView';

export default function App() {

  return (
    <SafeAreaProvider>
      <BrowserView />
    </SafeAreaProvider>
  );
}

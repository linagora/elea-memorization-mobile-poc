// App root: provides the safe-area context and mounts the BrowserView.
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrowserView } from './ui/browserView';

export function App() {
  return (
    <SafeAreaProvider>
      <BrowserView />
    </SafeAreaProvider>
  );
}

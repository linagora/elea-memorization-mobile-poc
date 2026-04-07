import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrowserView } from './ui/browserView';

export function App() {
  return (
    <SafeAreaProvider>
      <BrowserView />
    </SafeAreaProvider>
  );
}

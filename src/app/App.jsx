import { SafeAreaProvider } from 'react-native-safe-area-context';
import BrowserView from './BrowserView';

export default function App() {
  return (
    <SafeAreaProvider>
      <BrowserView />
    </SafeAreaProvider>
  );
}

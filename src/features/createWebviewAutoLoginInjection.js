import { createInjectedScript } from './injectedScripts/createInjectedScript';
import { AUTO_LOGIN_INJECTION_SCRIPT } from './injectedScripts/generated/injectedScripts.generated';

export function createWebviewAutoLoginInjection(config) {
  return createInjectedScript({
    script: AUTO_LOGIN_INJECTION_SCRIPT,
    globals: {
      __memoLoginUsername: config?.username ?? '',
      __memoLoginPassword: config?.password ?? '',
    },
  });
}

export default createWebviewAutoLoginInjection;

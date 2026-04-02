import { createInjectedScript } from '../injectedScripts/createInjectedScript';
import { MOBILE_INJECTION_SCRIPT } from '../injectedScripts/generated/injectedScripts.generated';

export function createWebviewMobileInjection(insetsTop) {
  return createInjectedScript({
    script: MOBILE_INJECTION_SCRIPT,
    globals: {
      __memoInsetsTop: Number(insetsTop || 0),
    },
  });
}

export default createWebviewMobileInjection;

import {
  AUTO_LOGIN_INJECTION_SCRIPT,
  CACHE_INJECTION_SCRIPT,
  MOBILE_INJECTION_SCRIPT,
} from './generatedScripts';

export function createInjectedScript(config) {
  var script = (config && config.script) || '';
  var globals = (config && config.globals) || {};

  var assignments = Object.keys(globals)
    .map(function(key) {
      return 'window.' + key + ' = ' + JSON.stringify(globals[key]) + ';';
    })
    .join('\n');

  return (
    '(function(){\n' +
    assignments +
    '\n})();\n' +
    '(function(){\n' +
    'try {\n' +
    script +
    '\n} catch (error) {\n' +
    "  try { window.ReactNativeWebView.postMessage('[INJECT] script error'); } catch (e) {}\n" +
    '}\n' +
    '})();\n' +
    'true;'
  );
}

export function createWebviewAutoLoginInjection(config) {
  return createInjectedScript({
    script: AUTO_LOGIN_INJECTION_SCRIPT,
    globals: {
      __memoLoginUsername: config?.username ?? '',
      __memoLoginPassword: config?.password ?? '',
    },
  });
}

export function createWebviewCacheInjection(config) {
  return createInjectedScript({
    script: CACHE_INJECTION_SCRIPT,
    globals: {
      __memoForceCache: Boolean(config && config.forceCache === true),
      __memoBaseUrl: (config && config.baseUrl) || '',
    },
  });
}

export function createWebviewMobileInjection(insetsTop) {
  return createInjectedScript({
    script: MOBILE_INJECTION_SCRIPT,
    globals: {
      __memoInsetsTop: Number(insetsTop || 0),
    },
  });
}

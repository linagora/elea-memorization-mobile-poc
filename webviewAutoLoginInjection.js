const AUTO_LOGIN_INJECTION_SOURCE = `(function() {
  if (window.__memoAutoLoginInstalled) return;
  window.__memoAutoLoginInstalled = true;

  var loginPath = '/login/index.php';
  var targetPath = '/local/memorization/index.php';
  var username = __LOGIN_USERNAME__;
  var password = __LOGIN_PASSWORD__;

  function post(msg) {
    try {
      window.ReactNativeWebView.postMessage('[LOGIN] ' + msg);
    } catch (e) {}
  }

  function shouldRun() {
    return window.location.pathname === loginPath;
  }

  function loginWithRequest() {
    if (!shouldRun()) return;
    if (!username || !password) {
      post('missing credentials');
      return;
    }
    if (window.__memoAutoLoginSubmitted) return;

    var tokenInput = document.querySelector('input[name="logintoken"]');
    var loginToken = tokenInput && tokenInput.value ? tokenInput.value : '';
    if (!loginToken) {
      setTimeout(loginWithRequest, 120);
      return;
    }

    window.__memoAutoLoginSubmitted = true;
    post('sending login request');

    var body = new URLSearchParams();
    body.set('anchor', '');
    body.set('logintoken', loginToken);
    body.set('username', username);
    body.set('password', password);

    fetch('/login/index.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
      .then(function() {
        post('login request done, navigating');
        window.location.href = targetPath;
      })
      .catch(function() {
        window.__memoAutoLoginSubmitted = false;
        post('login request failed');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loginWithRequest, {
      once: true,
    });
  } else {
    loginWithRequest();
  }
})();
true;`;

export function createWebviewAutoLoginInjection(config) {
  return AUTO_LOGIN_INJECTION_SOURCE
    .replace('__LOGIN_USERNAME__', JSON.stringify(config?.username ?? ''))
    .replace('__LOGIN_PASSWORD__', JSON.stringify(config?.password ?? ''));
}

export default createWebviewAutoLoginInjection;

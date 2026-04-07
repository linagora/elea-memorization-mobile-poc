(function() {
  var insetsTop = Number(window.__memoInsetsTop || 0);

  var css = [
    ':root {',
      '--inj-insets-top: ' + insetsTop + 'px;',
    '}',
    '.navbar.fixed-top {',
      'padding-top: var(--inj-insets-top) !important;',
      'height: calc(75px + var(--inj-insets-top)) !important;',
    '}',
    '#page {',
      'margin-top: calc(75px + var(--inj-insets-top)) !important;',
    '}',
    '#native-mobile-devtools {',
      'all: unset;',
      'background: #351771;',
      'color: #fff;',
      'height: 20px;',
      'padding: 10px 14px;',
      'border-radius: 10px;',
      'font-weight: 700;',
    '}',
    '.navbar.fixed-top .usermenu {',
      'align-items: center;',
      'justify-content: center;',
    '}',
  ].join('\n');

  function ensureViewport() {
    var viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
  }

  function ensureStyle() {
    var styleId = '__native_mobile_style__';
    var style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      (document.head || document.documentElement).appendChild(style);
    }
    style.type = 'text/css';
    style.textContent = css;
  }

  function ensureDevButton() {
    var usermenu = document.querySelector('.navbar.fixed-top .usermenu');
    if (!usermenu) return false;

    if (!document.getElementById('native-mobile-devtools')) {
      var button = document.createElement('button');
      button.id = 'native-mobile-devtools';
      button.textContent = 'DEV';
      button.addEventListener('click', function() {
        window.ReactNativeWebView.postMessage('[DEVTOOLS] Toggle dev tools');
      });
      usermenu.prepend(button);
    }

    return true;
  }

  function run() {
    ensureViewport();
    ensureStyle();
    if (ensureDevButton()) return;

    var observer = new MutationObserver(function() {
      if (ensureDevButton()) observer.disconnect();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function() {
      observer.disconnect();
    }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

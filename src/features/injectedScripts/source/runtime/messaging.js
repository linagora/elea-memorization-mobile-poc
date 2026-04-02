export function createMessagingTools(runtime) {
  // Post cache runtime logs back to React Native when the bridge is available.
  function post(message) {
    try {
      window.ReactNativeWebView.postMessage('[CACHE] ' + message);
    } catch (e) {}
  }

  // Send URL-encoded offline HTML snapshots with a dedicated prefix.
  function postSnapshot(value) {
    try {
      window.ReactNativeWebView.postMessage(runtime.snapshotMessagePrefix + value);
    } catch (e) {}
  }

  return {
    post: post,
    postSnapshot: postSnapshot,
  };
}

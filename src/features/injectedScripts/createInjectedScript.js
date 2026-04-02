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

export default createInjectedScript;

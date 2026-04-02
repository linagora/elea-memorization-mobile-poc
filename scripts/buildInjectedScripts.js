const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'src', 'features', 'injectedScripts', 'source');
const outputFile = path.join(
  projectRoot,
  'src',
  'features',
  'injectedScripts',
  'generated',
  'injectedScripts.generated.js'
);

const entries = [
  { exportName: 'CACHE_INJECTION_SCRIPT', entry: path.join(sourceRoot, 'cache', 'index.js') },
  { exportName: 'AUTO_LOGIN_INJECTION_SCRIPT', entry: path.join(sourceRoot, 'autoLogin.js') },
  { exportName: 'MOBILE_INJECTION_SCRIPT', entry: path.join(sourceRoot, 'mobile.js') },
];

async function buildEntry(entryPoint) {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2018',
    legalComments: 'none',
    minify: true,
    write: false,
  });

  return result.outputFiles[0].text.trim();
}

async function run() {
  const outputs = [];

  for (const item of entries) {
    const code = await buildEntry(item.entry);
    outputs.push('export const ' + item.exportName + ' = ' + JSON.stringify(code) + ';');
  }

  const content = outputs.join('\n') + '\n';
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, content, 'utf8');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

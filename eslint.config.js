const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      'web-build/**',
      '.expo/**',
      'assets/**',
      // Generated bundle.
      'src/injections/generatedScripts.js',
    ],
  },

  ...expoConfig,

  {
    // Node CommonJS scripts.
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    // ES5 WebView sources with the Moodle global.
    files: ['src/injections/source/**/*.js'],
    languageOptions: {
      globals: {
        M: 'readonly',
        // Modules inlined by esbuild at build time.
        ...globals.node,
      },
    },
    rules: {
      'no-var': 'off',
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'none',
          ignoreRestSiblings: true,
          caughtErrors: 'none',
        },
      ],
    },
  },
];

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
      // Bundle généré.
      'src/injections/generatedScripts.js',
    ],
  },

  ...expoConfig,

  {
    // Scripts Node CommonJS.
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    // Sources WebView ES5 avec global Moodle.
    files: ['src/injections/source/**/*.js'],
    languageOptions: {
      globals: {
        M: 'readonly',
        // Modules inlinés par esbuild au build.
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

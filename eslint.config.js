import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    // Node tooling scripts (e.g. scripts/shots.mjs) — Node globals, plus the browser
    // globals used inside Playwright `page.evaluate(() => …)` callbacks.
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        console: 'readonly',
        document: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      // TypeScript (tsc --noEmit in `build`) resolves identifiers; core no-undef
      // misfires on DOM/global types, so defer to the compiler.
      'no-undef': 'off',
      // Allow intentionally-unused, underscore-prefixed args (e.g. params kept to
      // match an original C signature before a later epic uses them).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

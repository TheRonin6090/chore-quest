import js from '@eslint/js';
import compat from 'eslint-plugin-compat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', '**/node_modules/', 'web/public/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['server/**/*.ts', 'web/scripts/**/*.mjs', 'web/vite.config.ts', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Browser code runs on the iOS 12 iPad: flag web APIs it doesn't have (targets in .browserslistrc).
    files: ['web/src/**/*.{ts,tsx}'],
    ...compat.configs['flat/recommended'],
    languageOptions: { globals: globals.browser },
  },
);

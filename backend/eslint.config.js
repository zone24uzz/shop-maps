import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', '.mongo-data/', 'coverage/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // The logger and the dev database script are the only console writers.
    files: ['src/utils/logger.js', 'scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
];

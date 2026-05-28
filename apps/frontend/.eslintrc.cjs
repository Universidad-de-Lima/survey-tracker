module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'import'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:import/typescript'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    'import/order': ['error', { groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'], 'newlines-between': 'always', alphabetize: { order: 'asc', caseInsensitive: true } }],
    'import/no-duplicates': 'error',
    'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }],
    'prefer-const': 'error', 'no-var': 'error', eqeqeq: ['error', 'always'],
  },
  overrides: [
    { files: ['*.js'], rules: { '@typescript-eslint/no-var-requires': 'off' } },
  ],
};

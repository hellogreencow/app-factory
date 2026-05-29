module.exports = {
  env: { browser: true, es2021: true, node: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18' } },
  rules: { 'no-unused-vars': 'off', 'no-empty': 'warn', 'react/prop-types': 'off', 'react/react-in-jsx-scope': 'off' },
};

module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-trailing-spaces': 'off',
    'space-before-function-paren': 'off',
    'camelcase': 'off',
    'quotes': 'off',
    'comma-dangle': 'off',
    'padded-blocks': 'off',
    'brace-style': 'off',
    'object-shorthand': 'off',
    'no-multi-spaces': 'off',
    'no-multiple-empty-lines': 'off',
    'prefer-const': 'off',
    'no-unused-vars': 'off',
    'no-useless-escape': 'off'
  }
}

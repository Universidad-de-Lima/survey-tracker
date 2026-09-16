module.exports = {
  root: true,
  extends: ['@survey-tracker/eslint-config'],
  overrides: [
    {
      files: ['api/**/*.js', 'lib/**/*.js', 'api/**/*.cjs', 'lib/**/*.cjs'],
      env: {
        commonjs: true,
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};


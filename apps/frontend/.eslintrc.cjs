module.exports = {
  root: true,
  extends: ['@survey-tracker/eslint-config'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
};

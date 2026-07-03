import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', '**/*.mjs', '**/*.js'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      curly: 'warn',
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
    },
  },
);

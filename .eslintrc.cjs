// ESLint 기본 설정 — TypeScript + NestJS 표준 룰셋 + import 정렬.
// 본 설정은 T-0003 의 일부이며, 룰 강화·완화는 별도 ADR 또는 task 로 진행한다.
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  // dist / coverage / node_modules 는 lint 대상 아님
  ignorePatterns: ['.eslintrc.cjs', 'dist/', 'coverage/', 'node_modules/'],
  rules: {
    // NestJS 의 DI 와 decorator 사용 패턴은 표준 룰과 부딪힐 수 있어 완화
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    // import 정렬: 외부 → 내부 → 상대경로 순
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
};

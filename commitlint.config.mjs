// Chuẩn commit của nhóm: <type>(<scope>): <mô tả ngắn>. Chi tiết: docs/git-flow.md, mục 5.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'refactor',
        'style',
        'docs',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        'merge',
        'release',
        'review',
        'fixreview',
      ],
    ],
    // Cho phép viết mô tả tiếng Việt tự nhiên.
    'subject-case': [0],
  },
};

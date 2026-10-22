// Chuẩn commit của nhóm: <type>(<scope>): <mô tả ngắn>. Chi tiết: docs/git-flow.md, mục 5.
export default {
  extends: ['@commitlint/config-conventional'],
  // Merge commit do GitHub tạo từ tiêu đề PR, đuôi "(#số)"; tiêu đề đã được job "PR title" kiểm.
  // Không bỏ qua thì PR phát hành (gom mọi commit từ main) bị đỏ vì tiêu đề merge dài quá 100 ký tự.
  ignores: [(message) => /^merge\([^)]+\): .+ \(#\d+\)$/.test(message.split('\n')[0] ?? '')],
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

#!/usr/bin/env bash
# Kiểm số trong tên nhánh của PR là số issue (docs/git-flow.md mục 2):
#   nhánh feature/<số>-<tên> hoặc fix/<số>-<tên>, và mô tả PR có "Closes #<cùng số>".
# Dùng: HEAD_REF=feature/21-cart-api PR_BODY="... Closes #21" bash .github/scripts/check-branch-issue.sh
set -euo pipefail

case "${HEAD_REF:?}" in
  release/* | hotfix/* | review/* | dependabot/*)
    echo "Bỏ qua nhánh $HEAD_REF"
    exit 0
    ;;
esac

if [[ ! "$HEAD_REF" =~ ^(feature|fix)/([0-9]+)-[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "::error::Nhánh '$HEAD_REF' sai tên. Đúng: feature/<số-issue>-<tên> hoặc fix/<số-issue>-<tên>, chữ thường, vd. feature/21-cart-api. Số là số của issue, không phải số PR."
  exit 1
fi

issue="${BASH_REMATCH[2]}"
if ! grep -Eiq "(closes|fixes|resolves) #${issue}([^0-9]|$)" <<<"${PR_BODY:-}"; then
  echo "::error::Mô tả PR thiếu dòng 'Closes #${issue}' (đúng số issue trong tên nhánh '$HEAD_REF')."
  exit 1
fi

echo "Nhánh $HEAD_REF khớp issue #${issue}"

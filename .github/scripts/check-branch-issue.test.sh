#!/usr/bin/env bash
# Test cho check-branch-issue.sh. Chạy: bash .github/scripts/check-branch-issue.test.sh
set -u
dir="$(cd "$(dirname "$0")" && pwd)"
fail=0

expect() {
  local want="$1" ref="$2" body="$3" got=0
  HEAD_REF="$ref" PR_BODY="$body" bash "$dir/check-branch-issue.sh" >/dev/null 2>&1 || got=1
  if [ "$want" = pass ] && [ "$got" -ne 0 ]; then echo "SAI: '$ref' phải qua"; fail=1; fi
  if [ "$want" = fail ] && [ "$got" -eq 0 ]; then echo "SAI: '$ref' phải bị chặn"; fail=1; fi
}

expect pass 'feature/21-cart-api' 'Làm giỏ hàng. Closes #21'
expect pass 'fix/24-oidc-immutable-sub' 'Closes #24'
expect pass 'feature/21-cart-api' 'CLOSES #21'
expect fail 'feature/21-cart-api' 'Closes #22'
expect fail 'feature/22-cart-api' 'Closes #221'
expect fail 'feature/21-cart-api' 'Không có dòng closes'
expect fail 'feature/cart-api' 'Closes #21'
expect fail 'feat/21-cart-api' 'Closes #21'
expect fail 'feature/21-Cart-API' 'Closes #21'
expect pass 'release/v0.1.0' ''
expect pass 'hotfix/v0.1.1' ''
expect pass 'dependabot/npm_and_yarn/vitest-5.0.4' ''

if [ "$fail" -eq 0 ]; then echo "check-branch-issue: đủ 12 trường hợp đúng"; fi
exit "$fail"

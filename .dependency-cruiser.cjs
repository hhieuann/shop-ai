/**
 * Luật layer theo ADR-009 (docs/adr/0009-layer-hexagonal-rut-gon.md).
 * Chạy: pnpm deps:check. CI tự chạy khi đã có services/api/src.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-chi-chua-luat-thuan',
      comment:
        'domain không import application, infra, handler hay AWS SDK. Luật nghiệp vụ phải test được mà không cần AWS.',
      severity: 'error',
      from: { path: '^services/api/src/modules/[^/]+/domain/' },
      to: {
        path: '(^services/api/src/modules/[^/]+/(application|infra)/)|(handler[.]ts$)|(@aws-sdk)|(@aws-lambda-powertools)',
      },
    },
    {
      name: 'application-di-qua-port',
      comment: 'use case không gọi thẳng infra hay AWS SDK; đi qua interface trong ports.ts.',
      severity: 'error',
      from: { path: '^services/api/src/modules/[^/]+/application/' },
      to: { path: '(^services/api/src/modules/[^/]+/infra/)|(@aws-sdk)' },
    },
    {
      name: 'module-khong-import-module-khac',
      comment: 'Cần dữ liệu của module khác thì qua port hoặc sự kiện.',
      severity: 'error',
      from: { path: '^services/api/src/modules/([^/]+)/' },
      to: {
        path: '^services/api/src/modules/',
        pathNot: '^services/api/src/modules/$1/',
      },
    },
    {
      name: 'khong-phu-thuoc-vong',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};

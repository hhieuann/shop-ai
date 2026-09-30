# ADR-0009: Kiến trúc layer của backend

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026
- Người quyết: An (chịu trách nhiệm), Hoàng, Nhân

## Bối cảnh

- Backend chạy trên Lambda bằng TypeScript. Nhóm 3 người, 2 người mới với cloud, có 8 tuần.
- Cần nhanh (khởi động lạnh thấp) và dễ kiểm soát (ranh giới rõ, test được, review được).
- Có một chỗ phải hoán đổi được nguồn dữ liệu gợi ý: baseline, Personalize batch, Personalize real-time lúc demo.

## Quyết định

Chia backend thành các module theo nghiệp vụ: `catalog`, `cart`, `ordering`, `recommendation`, `events`, `admin`. Bên trong mỗi module dùng Hexagonal rút gọn:

- `handler.ts` nhận request, kiểm input bằng zod, lấy claims JWT, gọi use case, đổi lỗi sang HTTP
- `application/` chứa use case; chỉ gọi port là các interface trong `ports.ts`
- `domain/` chứa luật nghiệp vụ thuần, không I/O, không import AWS SDK
- `infra/` chứa adapter cho DynamoDB, SQS, Personalize, hiện thực các port

Mỗi module deploy thành một Lambda có router nhỏ bên trong. Mỗi worker chạy nền là một Lambda riêng.

## Các lựa chọn đã cân nhắc

| Kiểu layer | Độ phức tạp | Hiệu năng trên Lambda | Dễ kiểm soát | Dễ test | Hợp với nhóm |
|---|---|---|---|---|---|
| 3 tầng Controller → Service → Repository | Thấp | Tốt | Vừa | Vừa | Rất quen |
| Clean Architecture đủ các vòng | Cao | Tốt, nhiều file | Cao | Cao | Nặng cho 8 tuần |
| **Hexagonal rút gọn** | Vừa | Tốt | Cao | Cao | Hợp |
| Vertical slice | Thấp | Tốt | Vừa | Vừa | Được |
| NestJS hoặc Express trong Lambda | Vừa | Kém hơn | Cao | Cao | Được |

| Chia Lambda theo | Số hàm | Quyền IAM | Khi deploy lỗi |
|---|---|---|---|
| Mỗi route | ~25 | Hẹp nhất | Ảnh hưởng 1 route |
| **Mỗi module** | 6–8 | Theo module | Ảnh hưởng 1 module |
| Cả app | 1 | Rộng | Sập cả app |

## Hệ quả

- Dễ hơn: test lõi không cần AWS; đổi nguồn gợi ý chỉ bằng flag; review và cấp quyền IAM theo module.
- Khó hơn: người mới cần làm quen khái niệm port; phải giữ kỷ luật không import AWS SDK trong `domain`.
- Cần xem lại khi: một route trong module có tải khác hẳn phần còn lại, lúc đó tách route đó ra Lambda riêng.

## Việc cần làm

- [ ] An dựng module mẫu `catalog` đúng khuôn trong Sprint 0
- [ ] `.dependency-cruiser.cjs` chặn vi phạm; CI chạy `pnpm deps:check` (đã có sẵn)
- [ ] Buổi 60 phút đi qua module mẫu cho cả nhóm

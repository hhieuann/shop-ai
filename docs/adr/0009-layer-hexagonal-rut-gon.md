# ADR-0009: Kiến trúc backend: modular monolith, bên trong mỗi module là Hexagonal rút gọn

- Trạng thái: Chấp nhận
- Ngày: 30/09/2026 (bổ sung tên gọi và so sánh cùng ngày)
- Người quyết: An (chịu trách nhiệm), Hoàng, Nhân

## Bối cảnh

- Backend chạy trên Lambda bằng TypeScript. Nhóm 3 người, 2 người mới với cloud, có 8 tuần.
- Cần nhanh (khởi động lạnh thấp) và dễ kiểm soát (ranh giới rõ, test được, review được).
- Có một chỗ phải hoán đổi được nguồn dữ liệu gợi ý: mô hình tự xây, hoặc hàng bán chạy cho người mới (ADR-0016).

## Quyết định

Quyết định này trả lời hai câu hỏi khác nhau:

1. **Chia cả hệ thống thành mấy phần, deploy ra sao?** → **modular monolith**
2. **Bên trong một phần, code xếp thành tầng thế nào?** → **Hexagonal (Ports & Adapters) rút gọn**

### 1. Cả hệ thống: modular monolith

- Chia theo module nghiệp vụ: `catalog`, `cart`, `ordering`, `recommendation`, `events`, `admin`.
- Một repo, một pipeline, deploy cùng lúc và chung số phiên bản.
- Mỗi module là một Lambda có router nhỏ bên trong, có bảng DynamoDB và quyền IAM riêng. Mỗi worker chạy nền là một Lambda riêng.
- Module **không import code của module khác**. Cần dữ liệu của nhau thì đi qua port (interface) hoặc sự kiện SQS.

### 2. Bên trong mỗi module: Hexagonal rút gọn

- `handler.ts` nhận request, kiểm input bằng zod, lấy claims JWT, gọi use case, đổi lỗi sang HTTP
- `application/` chứa use case; chỉ gọi port là các interface trong `ports.ts`
- `domain/` chứa luật nghiệp vụ thuần, không I/O, không import AWS SDK
- `infra/` chứa adapter cho DynamoDB, SQS, hiện thực các port

### Cách gọi thống nhất

Trong code review và báo cáo FCAJ, gọi là:

> Modular monolith trên nền serverless: mỗi module nghiệp vụ là một Lambda với bảng DynamoDB riêng; bên trong mỗi module theo kiến trúc Hexagonal (Ports & Adapters).

## Vì sao là modular monolith, không phải microservices

| | Monolith 3 layer | Modular monolith | Microservices | Bài của nhóm |
|---|---|---|---|---|
| Chia code theo | Tầng kỹ thuật (controller, service, repository) | Module nghiệp vụ | Service độc lập | Module nghiệp vụ |
| Repo, pipeline | 1 | 1 | Thường mỗi service một cái | 1 repo, 1 pipeline |
| Deploy | Cả khối | Cả khối | Từng service riêng, phiên bản riêng | Mỗi module một Lambda, nhưng deploy cùng lúc, chung số phiên bản |
| Database | Chung | Chung hoặc tách phần | Mỗi service một database | Mỗi module một bảng DynamoDB |
| Các phần nói chuyện | Gọi hàm tự do | Qua cửa công khai của module | Qua mạng (HTTP, queue) | Qua interface hoặc sự kiện SQS; cấm import chéo |
| Hợp khi | App nhỏ, một người | Team nhỏ, cần ranh giới rõ | Nhiều team cần deploy độc lập | 3 người, 8 tuần, serverless |

Khi chạy, bài này **trông giống microservices**: mỗi module là một Lambda riêng, có bảng và quyền IAM riêng. Nhưng code chung một repo, chung pipeline, deploy cùng lúc và chung số phiên bản, nên về bản chất vẫn là modular monolith.

Không chọn microservices vì microservices giải bài toán **nhiều team** cần deploy độc lập với nhau. Với 3 người, nó thêm những thứ không cần:

- Các phần gọi nhau qua mạng: chậm hơn và có thêm kiểu lỗi mới
- Đặt hàng kéo theo trừ kho ở hai service khác nhau: phải xử lý giao dịch phân tán
- Mỗi service một pipeline, một bộ giám sát, một số phiên bản

Luật "module không import module khác" là thứ giữ cho code **modular**, không thành một đống gọi chéo. Nhờ luật này, sau này muốn tách một module thành microservice thật cũng dễ, vì module đó đã có bảng riêng và giao tiếp qua cửa riêng.

## Hexagonal rút gọn khác 3 layer ở đâu

Hexagonal rút gọn là 3 layer thêm đúng một luật: **phụ thuộc đảo chiều**.

```text
3 layer thường:
  Controller → Service → Repository → DynamoDB
  (service phụ thuộc thẳng vào code gọi database)

Hexagonal rút gọn:
  handler → use case → domain (luật thuần)
               │ gọi
               ▼
        port (interface do lõi tự định nghĩa)
               ▲ hiện thực
        adapter DynamoDB ở tầng infra
  (database phụ thuộc vào lõi, lõi không biết database là gì)
```

| Spring | Bài của nhóm |
|---|---|
| `@RestController` | `handler.ts` |
| `@Service` | `application/placeOrder.ts` (use case) |
| Luật nghiệp vụ trong entity hoặc service | `domain/` (hàm thuần, không import AWS SDK) |
| `interface OrderRepository` | `ports.ts` |
| Class hiện thực JPA | `infra/dynamoOrderRepository.ts` |

```ts
// ports.ts: lõi tự nói nó cần gì
export interface OrderRepository {
  save(order: Order): Promise<void>;
}

// application/placeOrder.ts: chỉ biết interface
export async function placeOrder(deps: { orders: OrderRepository }, input: PlaceOrderInput) {
  // ...
}

// infra/dynamoOrderRepository.ts: chi tiết DynamoDB nằm ở rìa
export class DynamoOrderRepository implements OrderRepository {
  // ...
}
```

Được hai thứ:

- **Test lõi không cần AWS:** truyền một repository giả vào là chạy được.
- **Đổi nguồn dữ liệu mà không sửa lõi:** gợi ý từ mô hình hay từ danh sách hàng bán chạy chỉ là hai adapter cho cùng một port.

Gọi là **rút gọn** vì bản đầy đủ (Clean Architecture) còn tách port đầu vào và đầu ra, map DTO ở mỗi ranh giới. Với 8 tuần, nhóm chỉ giữ interface cho những chỗ gọi ra ngoài: database, queue.

### Một request đi qua cấu trúc này

`POST /api/v1/orders` → CloudFront → API Gateway → Lambda `ordering` → `handler.ts` kiểm input → use case `placeOrder` → `domain/pricing.ts` tính tiền → port `OrderRepository` → adapter `DynamoOrderRepository` → bảng `orders`.

## Các lựa chọn đã cân nhắc

Kiểu tổ chức code bên trong module:

| Kiểu layer | Độ phức tạp | Hiệu năng trên Lambda | Dễ kiểm soát | Dễ test | Hợp với nhóm |
|---|---|---|---|---|---|
| 3 tầng Controller → Service → Repository | Thấp | Tốt | Vừa | Vừa | Rất quen |
| Clean Architecture đủ các vòng | Cao | Tốt, nhiều file | Cao | Cao | Nặng cho 8 tuần |
| **Hexagonal rút gọn** | Vừa | Tốt | Cao | Cao | Hợp |
| Vertical slice | Thấp | Tốt | Vừa | Vừa | Được |
| NestJS hoặc Express trong Lambda | Vừa | Kém hơn | Cao | Cao | Được |

Cách chia Lambda:

| Chia Lambda theo | Số hàm | Quyền IAM | Khi deploy lỗi |
|---|---|---|---|
| Mỗi route | ~25 | Hẹp nhất | Ảnh hưởng 1 route |
| **Mỗi module** | 6–8 | Theo module | Ảnh hưởng 1 module |
| Cả app | 1 | Rộng | Sập cả app |

## Hệ quả

- Dễ hơn: test lõi không cần AWS; đổi nguồn gợi ý chỉ bằng flag; review và cấp quyền IAM theo module; tách một module ra thành service riêng về sau không phải viết lại.
- Khó hơn: người mới cần làm quen khái niệm port; phải giữ kỷ luật không import AWS SDK trong `domain` và không import chéo giữa các module.
- Cần xem lại khi: một route trong module có tải khác hẳn phần còn lại (tách route đó ra Lambda riêng), hoặc nhóm lớn lên và cần deploy các module độc lập (cân nhắc microservices).

## Việc cần làm

- [ ] An dựng module mẫu `catalog` đúng khuôn trong Sprint 0
- [ ] `.dependency-cruiser.cjs` chặn vi phạm; CI chạy `pnpm deps:check` (đã có sẵn)
- [ ] Buổi 60 phút đi qua module mẫu cho cả nhóm

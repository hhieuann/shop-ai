# Vai trò trong nhóm

| Người | GitHub | Vai trò | Phụ trách chính |
|---|---|---|---|
| **An** | [@hhieuann](https://github.com/hhieuann) | Trưởng nhóm · nền tảng, DevOps, bảo mật hạ tầng | Hạ tầng, pipeline, phát hành, API và widget gợi ý, giám sát, chi phí |
| **Hoàng** | [@simonhoang611](https://github.com/simonhoang611) | Fullstack · nghiệp vụ bán hàng | Catalog, giỏ hàng, đơn hàng, admin, giao diện web, E2E |
| **Nhân** | [@Netanii](https://github.com/Netanii) | Dữ liệu, gợi ý · bảo mật dữ liệu và AI | Dữ liệu, pipeline gợi ý, sự kiện, threat model, kiểm thử bảo mật |

Trang riêng của từng người: [an.md](an.md) · [hoang.md](hoang.md) · [nhan.md](nhan.md)

## Vì sao chia như vậy

Mỗi người sở hữu **một phần trọn vẹn**, từ API tới dữ liệu tới giao diện của phần đó. Nhờ vậy ai cũng tự demo được phần mình, tự viết được workshop và blog từ đó. Chia theo tầng (một người frontend, một người backend) thì mọi người phải chờ nhau.

## Ai xem PR của ai

Mỗi khu vực có người phụ trách chính và một người dự phòng. Khi có PR, GitHub tự mời họ vào xem theo `.github/CODEOWNERS`. PR vào `develop` không bắt buộc duyệt: người được mời đọc và comment nếu thấy vấn đề, người viết tự merge khi CI xanh. PR vào `release/*` và `main` cần 1 người khác duyệt.

| Khu vực | Chính | Dự phòng |
|---|---|---|
| `infra/`, `.github/` | An | Nhân, xem từ góc bảo mật |
| `services/api/src/shared/`, `tests/load/` | An | Hoàng |
| `catalog`, `cart`, `ordering`, `admin`, `workers`, `apps/web`, E2E, `contracts/` | Hoàng | An |
| `recommendation` | An | Nhân |
| `data/`, `events`, `SECURITY.md` | Nhân | An |
| Tài liệu, cấu hình chung | Ai cũng được | |

## Nhịp làm việc chung

- **9:00 mỗi ngày:** standup viết trong nhóm chat, gồm hôm qua, hôm nay, vướng gì. Dùng lại nội dung này làm worklog FCAJ, nộp trước 9:00.
- **Đầu sprint:** họp lập kế hoạch 45 phút. **Cuối sprint:** demo trên staging, retro 20 phút.
- **Đọc PR được mời trong ngày.** Không bắt buộc duyệt, nhưng góp ý sớm rẻ hơn sửa lỗi khi code đã lên dev.
- **Vướng quá nửa ngày** thì hỏi trong nhóm. **Vướng quá một ngày** thì báo An. An báo mentor khi cần.
- **Quyết định kỹ thuật lớn** thì viết ADR, cả nhóm review, An chốt.
- **Bảng công việc:** GitHub Projects. Ai nhận việc thì tự gán issue và kéo cột.

## Lịch 8 tuần

| Tuần | An | Hoàng | Nhân |
|---|---|---|---|
| 1 · 29/09–05/10 | Thiết lập repo, AWS, OIDC; module mẫu | Môi trường, OpenAPI bản 0, khung web, thiết kế bảng | Kiểm tra Personalize, threat model, sinh dữ liệu v1 |
| 2 · 06–12/10 | Stack frontend, API, dữ liệu; dev tự deploy | Module catalog, trang sản phẩm | Dữ liệu v2, baseline và bảng chỉ số |
| 3 · 13–19/10 | Staging, smoke, phát hành v0.1.0 | Module giỏ hàng, E2E bản 1 | Module events, ẩn danh, KMS |
| 4 · 20–26/10 | API và widget gợi ý, dashboard, alarm | Đặt hàng qua SQS, email | Pipeline gợi ý mỗi đêm |
| 5 · 27/10–02/11 | Cầu dao chi phí, WAF, phát hành v0.2.0 | Admin, integration test | Rule WAF, thí nghiệm đầu độc, test IDOR |
| 6 · 03–09/11 | Load test, canary, diễn tập phục hồi, v1.0.0-rc.1 | Sửa lỗi, hiệu năng web | Chỉ số cuối, báo cáo bảo mật |
| 7–8 · 10–23/11 | Proposal, tập demo, v1.0.0 | Workshop, blog, sửa lỗi | Workshop, blog, sửa lỗi |
| 24–29/11 | Nộp workshop trên portal | | |

## Việc OJT của mỗi người (ngoài code)

- Worklog mỗi ngày, nộp trước 9:00, đủ 12 tuần
- 3 blog đăng trên group AWS Study Group. Gợi ý chủ đề có trong trang riêng của từng người
- Ít nhất 10 buổi lên văn phòng và 3 sự kiện
- Trang workshop từ phần mình làm ([docs/workshop/](../workshop/)) và phần Self-Assessment

Thiếu blog hoặc thiếu worklog là mất trọn điểm mục Worklog/Blog. Đừng để dồn tới cuối kỳ.

## Mốc chung

| Mốc | Ngày |
|---|---|
| Chốt nghiệp vụ Sprint 1 | 05/10 |
| `v0.1.0`: xem hàng, đăng nhập, giỏ hàng | 19/10 |
| `v0.2.0`: đặt hàng, gợi ý, admin, bảo mật | 02/11 |
| `v1.0.0-rc.1`: đủ số liệu đo đạc | 09/11 |
| `v1.0.0`: bản demo cuối | 23/11 |
| Nộp workshop trên portal FCAJ | trước 29/11 |

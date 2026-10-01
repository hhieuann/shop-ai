<!-- Tiêu đề PR theo docs/git-flow.md mục 5, ví dụ: merge(feature/12-cart-api): tích hợp API giỏ hàng vào develop.
     Tiêu đề PR trở thành commit merge, nên CI kiểm tra tiêu đề. -->

## Làm gì


## Vì sao

Closes #

## Cách kiểm tra


## Ảnh chụp (nếu đổi giao diện)


## Checklist

- [ ] Có test cho luật nghiệp vụ mới hoặc cho lỗi vừa sửa
- [ ] `contracts/openapi.yaml` đã cập nhật nếu đổi API
- [ ] Không có secret, không ghi dữ liệu cá nhân vào log
- [ ] Đã xem `cdk diff` trong phần Summary của CI nếu đổi `infra/`
- [ ] Cập nhật tài liệu hoặc ADR nếu đổi thiết kế
- [ ] PR dưới khoảng 400 dòng thay đổi

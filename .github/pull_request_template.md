<!-- Tiêu đề PR theo Conventional Commits, ví dụ: feat(cart): giới hạn 5 sản phẩm mỗi loại.
     Squash merge lấy tiêu đề PR làm commit message, nên CI sẽ kiểm tra tiêu đề. -->

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

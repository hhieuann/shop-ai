# Runbook: Lambda pre sign-up lỗi

Alarm: `<tiền tố>-presignup-errors` · Ngưỡng: ≥ 1 lỗi trong 5 phút, không tính lần từ chối đăng ký (`SignUpRejectedError`: trùng hoặc sai luật username) · Người trực: An

Lambda pre sign-up do **Cognito** gọi mỗi lần có người đăng ký, để chặn trùng username. Nó lỗi thì **không ai đăng ký được**, và lỗi này **không hiện ở alarm 5xx** vì không đi qua API Gateway.

## Dấu hiệu

- Email "ALARM: shop-…-presignup-errors".
- Trang `/register` báo lỗi chung khi bấm "Tạo tài khoản".

## Kiểm tra nhanh (5 phút đầu)

1. CloudWatch → **Log Management** → tick log group `<tiền tố>-api-PreSignUpLogs…` → **View in Logs Insights** → khung giờ 1 giờ:

   ```text
   fields @timestamp, message, error.name, error.message
   | filter level = "ERROR" or @message like /Task timed out/
   | sort @timestamp desc
   | limit 20
   ```

2. X-Ray traces → lọc `annotation.Service = "account-signup"` → xem lời gọi Cognito `ListUsers` có lỗi không.

## Đọc nhanh nguyên nhân thường gặp

| Thấy gì | Nghĩa là |
|---|---|
| `AccessDeniedException` cho `cognito-idp:ListUsers` | Quyền IAM của Lambda bị đổi |
| `Task timed out after 3.00 seconds` | Cognito chậm hoặc khởi động lạnh lâu |
| `TooManyRequestsException` | Gọi `ListUsers` quá giới hạn của Cognito (có ai đăng ký dồn dập, có thể là spam) |

## Giảm thiểu

- Do deploy mới: rollback như [api-5xx.md](api-5xx.md) mục Giảm thiểu.
- Đăng ký dồn dập bất thường: báo Nhân (bảo mật) xem có phải tấn công không.

## Sau sự cố

Thử đăng ký một tài khoản thật trên môi trường đó; trên prod viết postmortem trong 48 giờ.

## Alarm `shop-prd-postconfirmation-errors` (trigger đăng xuất mọi thiết bị)

Ngưỡng: ≥ 1 lần lỗi hoặc throttle trong 5 phút · Chỉ prod · Người trực: Nhân (threat model L9)

Lambda post confirmation do Cognito gọi sau khi khách đặt lại mật khẩu, để đăng xuất mọi thiết bị. Cognito đổi mật khẩu **trước** rồi mới gọi trigger (thử trên dev 17/11), nên khi trigger lỗi:

- Mật khẩu mới **đã dùng được**, mật khẩu cũ bị từ chối.
- Phiên trên máy khác **chưa bị thu hồi**: kẻ đã đăng nhập bằng mật khẩu bị lộ vẫn dùng tiếp tới 30 ngày.
- Web nhận lỗi Cognito có message bắt đầu bằng `PostConfirmation`: `UserLambdaValidationException` khi hàm chạy rồi ném lỗi (`SESSION_REVOKE_FAILED`), `UnexpectedLambdaException` khi hàm bị throttle.

Alarm cộng cả Throttles vì hàm bị throttle thì không chạy, Errors vẫn bằng 0.

**Kiểm tra:** Logs Insights trên log group `shop-prd-api-PostConfirmation…`, cùng câu truy vấn như trên; thấy `AccessDeniedException` là quyền IAM bị đổi, `TooManyRequestsException` là gọi Cognito quá giới hạn.

**Giảm thiểu:** sửa nguyên nhân xong, những khách đặt lại mật khẩu trong lúc lỗi vẫn còn phiên cũ. Lấy giờ lỗi trong log rồi báo nhóm; nếu cần, admin chạy `aws cognito-idp admin-user-global-sign-out` cho từng tài khoản khách báo nghi bị lộ.

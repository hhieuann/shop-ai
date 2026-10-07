# Đăng nhập và tạo tài khoản `/login`, `/register`

Code: `features/auth/pages/LoginPage.tsx` (**trang tạm**, An thay khi làm Cognito), `shared/auth/token.ts`. Quyết định: `docs/adr/0007-http-api-jwt-cognito.md` (Cognito user pool, đăng nhập SRP, nhóm `admin` bắt buộc MFA). Phạm vi: `project-plan.md` ("Đăng ký, đăng nhập, phân quyền khách/admin"). Đọc kèm [design-system.md](../design-system.md).

Người làm: **An**. File này chỉ quy định giao diện; luồng Cognito (gọi API nào, lưu token ra sao) An quyết.

Bố cục: header thu gọn, một thẻ form hẹp ở giữa trang, nhãn đậm phía trên ô nhập, nút hiện/ẩn mật khẩu trong ô, link chuyển qua lại "Đã có tài khoản? / Tạo tài khoản" ở cuối thẻ.

## 1. Đường dẫn và dữ liệu

| Đường dẫn | Màn hình |
|---|---|
| `/login` | Đăng nhập: email + mật khẩu |
| `/register` | Tạo tài khoản: email + mật khẩu + nhập lại; xong chuyển sang bước nhập mã |
| `/register` (bước 2) | Nhập mã xác nhận gửi về email. Cùng đường dẫn, đổi bằng state; F5 thì quay về bước 1 |

**Hợp đồng với các trang khác (giữ nguyên):** trang được mở bằng `navigate('/login', { state: { from, reason? } })`. Link "Tạo tài khoản" và "Đăng nhập" chuyển tiếp **cả `from` lẫn `reason`** cho nhau. Tạo tài khoản và xác nhận mã xong thì **đăng nhập luôn**, khách không phải gõ lại.

Đăng nhập hoặc tạo tài khoản thành công thì **không tự `navigate(from)`** nữa, mà làm đúng hai việc (cart BR-10, BR-11):
1. Gọi `notifyAuthChanged()` (`shared/auth/token.ts`) để giỏ hàng biết đã đăng nhập.
2. `await continueAfterSignIn(navigate, queryClient, from)` (`features/cart/lib/afterSignIn.ts`). Hàm này gộp giỏ khách vào giỏ tài khoản rồi tự chuyển trang: sang `/checkout`, về `/cart` kèm thông báo, hoặc về `from`. Trang đăng nhập không cần biết gì về giỏ.

`reason: 'checkout'`: khách vãng lai bấm "Đặt hàng" ở giỏ. Dưới tiêu đề hiện câu "Đăng nhập hoặc tạo tài khoản để đặt hàng. Các sản phẩm bạn đã chọn được giữ nguyên." (trang tạm đã có câu này).

Đã đăng nhập mà vào `/login` hoặc `/register` → về `from` (hoặc `/`).

## 2. Bố cục

Dùng `FocusLayout` (design-system §9.16). Link bên phải header: "Quay lại" (icon `ArrowLeft`) → `from` nếu có, không thì `/`.

```
              ┌ Thẻ 440px ───────────────────┐
              │        Đăng nhập (H1)        │
              │ Đăng nhập để dùng giỏ hàng … │
              │ Email                        │
              │ [                          ] │
              │ Mật khẩu                     │
              │ [                     👁  ] │
              │ [        Đăng nhập         ] │
              │ ──────────────────────────── │
              │ Chưa có tài khoản? Tạo tài khoản │
              └──────────────────────────────┘
```

| Phần | Giá trị |
|---|---|
| Vùng trang | `min-height` đủ để footer nằm đáy màn hình; thẻ căn giữa ngang, cách header 40px (<640: 16px) |
| Thẻ | rộng 100%, tối đa **440px**; `--bg-surface`, viền `--border-divider`, bo 16px, padding 32px (<640: 24px 16px) |
| Tiêu đề | `<h1>` 24/32/600 căn giữa; dòng phụ 14/20 `--fg-muted` căn giữa, cách 4px; cách form 24px |
| Form | ô `Field` cỡ **48px**, xếp dọc cách nhau 16px; nút cách ô cuối 24px |
| Nút chính | `Button primary lg`, `width:100%` |
| Chân thẻ | đường kẻ 1px `--border-divider` cách nút 24px, rồi một dòng 14/20 căn giữa cách 24px: chữ `--fg-subdued` + link `--fg-primary` 500 |

Không có logo trong thẻ (header đã có), không có ô "Ghi nhớ đăng nhập".

## 3. Các khối

### 3.1 Đăng nhập `/login`
| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Đăng nhập" |
| Dòng phụ | "Đăng nhập để dùng giỏ hàng và đặt hàng." |
| Email | `type="email"`, `autocomplete="username"`, `inputMode="email"`, `autoFocus` |
| Mật khẩu | `PasswordField` (design-system §9.4), `autocomplete="current-password"` |
| Nút | "Đăng nhập" → đang gửi "Đang đăng nhập…" |
| Chân thẻ | "Chưa có tài khoản? **Tạo tài khoản**" → `/register` |

Tài khoản admin (nhóm `admin`, bắt buộc MFA theo ADR-0007): sau mật khẩu hiện bước nhập mã MFA, dùng chung bố cục với bước nhập mã ở 3.3 (tiêu đề "Xác thực hai lớp", không có "Gửi lại mã"). Loại MFA (ứng dụng xác thực hay SMS) do An chọn.

### 3.2 Tạo tài khoản `/register` (bước 1)
| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Tạo tài khoản" |
| Dòng phụ | "Mua hàng nhanh hơn và theo dõi đơn của bạn." |
| Email | như đăng nhập, `autocomplete="email"` |
| Mật khẩu | `PasswordField`, `autocomplete="new-password"`, kèm **danh sách điều kiện** bên dưới |
| Nhập lại mật khẩu | `PasswordField`, `autocomplete="new-password"`; lỗi "Mật khẩu nhập lại không khớp." |
| Nút | "Tạo tài khoản" → "Đang tạo tài khoản…" |
| Chân thẻ | "Đã có tài khoản? **Đăng nhập**" → `/login` |

**Danh sách điều kiện mật khẩu** (thay cho thanh đo độ mạnh mật khẩu): `<ul>` ngay dưới ô, cách 8px, mỗi dòng 12/18 gap 4px với icon 16px. Chưa đạt: icon `Circle` + chữ `--fg-subdued`; đạt: icon `CircleCheck` + chữ `--fg-success`. Cập nhật khi gõ; nối vào ô bằng `aria-describedby`. Nội dung lấy đúng **chính sách mật khẩu của user pool** (engineering-plan: An đặt). Nếu An giữ mặc định của Cognito thì là: ít nhất 8 ký tự; có chữ hoa; có chữ thường; có số; có ký tự đặc biệt.

Không có ô họ tên và số điện thoại: họ tên, số điện thoại nhập ở trang đặt hàng cho từng đơn.

### 3.3 Nhập mã xác nhận (bước 2)
| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Xác nhận email" |
| Dòng phụ | "Nhập mã 6 số vừa gửi tới **{email}**." (email đậm 500 `--fg-default`) |
| Ô mã | `Field` 48px, nhãn "Mã xác nhận", `inputMode="numeric"`, `autocomplete="one-time-code"`, `maxLength=6`, chữ 20/28/600 `tabular-nums`, `letter-spacing: .3em`, căn giữa |
| Nút | "Xác nhận" → "Đang xác nhận…" |
| Gửi lại | nút `ghost md` căn giữa dưới nút chính: "Gửi lại mã"; đang gửi thì vô hiệu ("Đang gửi…"); gửi xong `Alert success` "Đã gửi mã mới." |

## 4. Trạng thái

Lỗi từ Cognito hiện bằng `Alert danger` ở đầu form (dưới dòng phụ), `role="alert"`, focus vào đó. Lỗi của một ô cụ thể hiện dưới ô đó (design-system §9.4). Câu chữ đề xuất:

| Lỗi Cognito | Câu hiển thị | Ở đâu |
|---|---|---|
| `NotAuthorizedException` (sai email/mật khẩu) | "Email hoặc mật khẩu không đúng." (không nói rõ sai cái nào) | Alert |
| `UserNotConfirmedException` khi đăng nhập | chuyển sang bước nhập mã (3.3) và tự gửi lại mã | — |
| `UsernameExistsException` | "Email này đã có tài khoản." + link "Đăng nhập" | dưới ô Email |
| `InvalidPasswordException` | "Mật khẩu chưa đạt điều kiện bên dưới." | dưới ô Mật khẩu |
| `CodeMismatchException` | "Mã không đúng. Kiểm tra lại email mới nhất." | dưới ô mã |
| `ExpiredCodeException` | "Mã đã hết hạn. Bấm Gửi lại mã." | dưới ô mã |
| `LimitExceededException`, `TooManyRequestsException` | "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại." | Alert |
| Lỗi mạng | "Không kết nối được máy chủ, vui lòng thử lại." | Alert |

Kiểm tra trước khi gửi (ở trình duyệt): ô trống ("Vui lòng nhập email"), email sai dạng ("Email không hợp lệ"), mật khẩu chưa đạt điều kiện, nhập lại không khớp. Đang gửi: nút `aria-busy`, các ô `readOnly`.

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| ≥640 | Như mục 2 |
| <640 | Thẻ tràn ngang (chỉ còn lề `--gutter` 16px), padding `24px 16px`, cách header 16px; ô nhập chữ 16px |

## 6. Trợ năng
- Một `<h1>` mỗi màn; khi đổi sang bước nhập mã, focus vào `<h1>` mới (`tabIndex={-1}`).
- Mọi ô có `<label>` hiển thị (không dùng placeholder thay nhãn).
- Nút hiện/ẩn mật khẩu: `aria-label` "Hiện mật khẩu" / "Ẩn mật khẩu", `aria-pressed`; không làm mất focus khỏi ô.
- `autocomplete` đúng như bảng để trình quản lý mật khẩu và mã OTP tự điền hoạt động.

## 7. Ngoài phạm vi
Đăng nhập bằng số điện thoại; passkey; đăng nhập Google/Apple; tài khoản doanh nghiệp; số điện thoại khôi phục tài khoản; tên và họ tách riêng khi đăng ký; điều khoản chương trình hội viên. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md).

## 8. Cần An xác nhận

**Phải làm khi thay trang tạm bằng Cognito (giỏ khách vãng lai, 07/10/2026):**
- Gọi `setTokenProvider(...)` lúc khởi động app (đã có từ trước) và gọi `notifyAuthChanged()` mỗi khi đăng nhập, tạo tài khoản xong, đăng xuất, hoặc token hết hạn không làm mới được.
- Sau khi đăng nhập **và** sau khi tạo tài khoản + xác nhận mã: `await continueAfterSignIn(navigate, queryClient, from)` thay cho `navigate(from)`.
- Link qua lại giữa `/login` và `/register` giữ nguyên `state` (`from`, `reason`).
- Khi đăng xuất: **không** xoá `localStorage` `shop-ai:guest-cart` (đó là giỏ khách mới sau khi đăng xuất, mặc định rỗng).
- Thử lại luồng: chưa đăng nhập thêm 2 món → Giỏ → "Đặt hàng" → tạo tài khoản mới → nhập mã → phải tới thẳng `/checkout` với đúng 2 món.

**Câu hỏi còn mở:**
- User pool có **tự đăng ký** (self sign-up) và xác nhận bằng **mã gửi email** không? Spec này giả định có.
- Chính sách mật khẩu thật (để viết danh sách điều kiện ở 3.2).
- **Quên mật khẩu**: Cognito hỗ trợ sẵn nhưng tài liệu dự án chưa nhắc. Nếu làm thì thêm link "Quên mật khẩu?" (ghost, căn phải) ngay dưới ô mật khẩu ở `/login`, và một màn hai bước như 3.2–3.3 (email → mã + mật khẩu mới). Chưa làm cho tới khi An quyết.
- Admin đăng nhập ở cùng `/login` hay một trang riêng.
- **Đăng xuất**: tài liệu chưa nhắc. Header hiện luôn trỏ "Tài khoản" tới `/login`; khi đã đăng nhập cần chỗ đăng xuất (ví dụ link "Tài khoản" đổi thành "Đăng xuất"). Chưa thiết kế cho tới khi An quyết.

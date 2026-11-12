# Đăng nhập, tạo tài khoản, quên mật khẩu `/login`, `/register`, `/forgot-password`

Code: `features/auth/pages/LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx` (chưa có), `features/auth/components/`, `shared/auth/cognito.ts`, `shared/auth/token.ts`. Quyết định: `docs/adr/0007-http-api-jwt-cognito.md` (Cognito user pool, đăng nhập SRP, nhóm `admin` bắt buộc MFA). Phạm vi: `project-plan.md` ("Đăng ký, đăng nhập, phân quyền khách/admin"). Đọc kèm [design-system.md](../design-system.md).

Người làm: **An**. File này chỉ quy định giao diện; luồng Cognito (gọi API nào, lưu token ra sao) An quyết.

Bố cục: header thu gọn, một thẻ form hẹp ở giữa trang, nhãn đậm phía trên ô nhập, nút hiện/ẩn mật khẩu trong ô, link chuyển qua lại "Đã có tài khoản? / Tạo tài khoản" ở cuối thẻ.

Sửa 10/11/2026 (góp ý của nhóm): nút con mắt không còn nhận focus khi bấm Tab (mục 6); ô mã đổi thành 6 ô vuông (3.3). Sửa 11/11/2026: icon con mắt theo trạng thái mật khẩu, đang ẩn là mắt nhắm, đang hiện là mắt mở (mục 6). Sửa 11/11/2026 (An chốt): thêm quên mật khẩu, link dưới nút "Đăng nhập" (3.1) và màn đặt lại hai bước (3.4). Sửa 12/11/2026: ghi lý do ô mã quên mật khẩu không kiểm riêng (mục 8).

## 1. Đường dẫn và dữ liệu

| Đường dẫn | Màn hình |
|---|---|
| `/login` | Đăng nhập: email + mật khẩu |
| `/register` | Tạo tài khoản: username + email + mật khẩu + nhập lại; xong chuyển sang bước nhập mã |
| `/register` (bước 2) | Nhập mã xác nhận gửi về email. Cùng đường dẫn, đổi bằng state; F5 thì quay về bước 1 |
| `/forgot-password` | Quên mật khẩu bước 1: nhập email |
| `/forgot-password` (bước 2) | Nhập mã gửi về email và mật khẩu mới. Cùng đường dẫn, đổi bằng state; F5 thì quay về bước 1 |

**Hợp đồng với các trang khác (giữ nguyên):** trang được mở bằng `navigate('/login', { state: { from, reason? } })`. Link "Tạo tài khoản" và "Đăng nhập" chuyển tiếp **cả `from` lẫn `reason`** cho nhau. Link "Quên mật khẩu?" và link quay về "Đăng nhập" ở 3.4 cũng vậy, kèm `email` đang gõ. Tạo tài khoản và xác nhận mã xong thì **đăng nhập luôn**, khách không phải gõ lại.

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
| Mật khẩu | `PasswordField` (design-system §9.4), `autocomplete="current-password"`. Thứ tự Tab: Email → Mật khẩu → nút "Đăng nhập" → "Quên mật khẩu?" (nút con mắt không nằm trong thứ tự Tab) |
| Nút | "Đăng nhập" → đang gửi "Đang đăng nhập…" |
| Quên mật khẩu | nút `ghost md` căn giữa ngay dưới nút "Đăng nhập" (như "Gửi lại mã" ở 3.3): "Quên mật khẩu?" → `/forgot-password`, mang theo email đang gõ và `from`, `reason`. Đặt dưới nút chứ không dưới ô mật khẩu, để Tab từ ô mật khẩu tới thẳng nút "Đăng nhập" (mục 6) |
| Chân thẻ | "Chưa có tài khoản? **Tạo tài khoản**" → `/register` |

Tài khoản admin (nhóm `admin`, bắt buộc MFA theo ADR-0007): sau mật khẩu hiện bước nhập mã MFA, dùng chung bố cục với bước nhập mã ở 3.3 (tiêu đề "Xác thực hai lớp", không có "Gửi lại mã"). Loại MFA (ứng dụng xác thực hay SMS) do An chọn.

Mở `/login` với `state.email` và `state.notice` (từ bước 2 của 3.4): điền sẵn email, hiện `Alert success` với nội dung `notice`, focus vào ô Mật khẩu thay vì ô Email.

### 3.2 Tạo tài khoản `/register` (bước 1)
| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Tạo tài khoản" |
| Dòng phụ | "Mua hàng nhanh hơn và theo dõi đơn của bạn." |
| Username | `Field` 48px, nhãn "Username", gợi ý dưới ô "Tên hiện trên header khi bạn đăng nhập.", `autocomplete="nickname"`, `autoCapitalize="none"`, `spellCheck={false}`. Đề xuất (chờ An): 3–20 ký tự, chữ thường không dấu, số, dấu chấm, gạch dưới; không trùng với người khác. Lỗi: "Vui lòng nhập username", "Username chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới", "Username này đã có người dùng." |
| Email | như đăng nhập, `autocomplete="email"` |
| Mật khẩu | `PasswordField`, `autocomplete="new-password"`, kèm **danh sách điều kiện** bên dưới |
| Nhập lại mật khẩu | `PasswordField`, `autocomplete="new-password"`; lỗi "Mật khẩu nhập lại không khớp.". Thứ tự Tab: Username → Email → Mật khẩu → Nhập lại mật khẩu → nút "Tạo tài khoản" |
| Nút | "Tạo tài khoản" → "Đang tạo tài khoản…" |
| Chân thẻ | "Đã có tài khoản? **Đăng nhập**" → `/login` |

**Danh sách điều kiện mật khẩu** (thay cho thanh đo độ mạnh mật khẩu): `<ul>` ngay dưới ô, cách 8px, mỗi dòng 12/18 gap 4px với icon 16px. Chưa đạt: icon `Circle` + chữ `--fg-subdued`; đạt: icon `CircleCheck` + chữ `--fg-success`. Cập nhật khi gõ; nối vào ô bằng `aria-describedby`. Nội dung lấy đúng **chính sách mật khẩu của user pool** (engineering-plan: An đặt). Nếu An giữ mặc định của Cognito thì là: ít nhất 8 ký tự; có chữ hoa; có chữ thường; có số; có ký tự đặc biệt.

Username là tên hiển thị trên nút tài khoản ở header (design-system §9.17). Không có ô họ tên và số điện thoại: họ tên, số điện thoại nhập ở trang đặt hàng cho từng đơn.

### 3.3 Nhập mã xác nhận (bước 2)
| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Xác nhận email" |
| Dòng phụ | "Nhập mã 6 số vừa gửi tới **{email}**." (email đậm 500 `--fg-default`) |
| Ô mã | `OtpInput` (design-system §9.4): nhãn "Mã xác nhận" phía trên, **6 ô vuông** chia đều bề ngang form, gap 8px, cao 56px (<640: gap 6px, cao 52px); mỗi ô một số 24/32/600 `tabular-nums` căn giữa. Bên dưới là **một** ô nhập thật (`inputMode="numeric"`, `autocomplete="one-time-code"`, không đặt `maxLength`: ô tự lọc số rồi cắt còn 6, vì trình duyệt cắt chữ dán theo `maxLength` trước khi lọc nên dán "123 456" sẽ mất số) nên dán mã, tự điền mã từ email hoặc SMS vẫn chạy. Chưa focus thì không ô nào sáng; mở bước này focus vẫn vào `<h1>` như mục 6 |
| Nút | "Xác nhận" → "Đang xác nhận…" |
| Gửi lại | nút `ghost md` căn giữa dưới nút chính: "Gửi lại mã"; đang gửi thì vô hiệu ("Đang gửi…"); gửi xong `Alert success` "Đã gửi mã mới.", xoá các số đã gõ và focus lại ô đầu |

**Cách gõ 6 ô** (giống nhau ở xác nhận email và xác thực hai lớp):
- Gõ số nào thì số đó vào ô đang sáng, ô sáng nhảy sang phải. Chữ và dấu cách bị bỏ. Backspace xoá số cuối và lùi một ô.
- Dán hoặc tự điền "123456", "123 456", "Mã: 123456": lấy 6 số đầu, điền một lượt.
- Bấm vào ô nào hoặc Tab tới thì ô trống đầu tiên sáng (không sửa số ở giữa; muốn sửa thì xoá lùi).
- Đủ 6 số thì **tự gửi**, không cần bấm "Xác nhận". Nút "Xác nhận" vẫn giữ (Enter, trình đọc màn hình, khi tự gửi lỗi mạng).
- Đang gửi: các ô `readOnly`, số đổi màu `--fg-muted`, không ô nào sáng, nút "Đang xác nhận…".
- Chưa đủ 6 số mà bấm "Xác nhận": lỗi dưới ô "Nhập đủ 6 số trong email." (xác thực hai lớp: "Nhập đủ 6 số trong ứng dụng xác thực.").

### 3.4 Quên mật khẩu `/forgot-password` (account.md BR-13)

Bước 1:

| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Đặt lại mật khẩu" |
| Dòng phụ | "Nhập email của tài khoản. Chúng tôi sẽ gửi mã 6 số để bạn đặt mật khẩu mới." |
| Email | như 3.1 (`autocomplete="username"`, `autoFocus`), điền sẵn email mang từ `/login` |
| Nút | "Gửi mã" → "Đang gửi…" |
| Chân thẻ | "Nhớ ra mật khẩu? **Đăng nhập**" → `/login`, giữ `from`, `reason` |

Bước 2:

| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Đặt mật khẩu mới" |
| Dòng phụ | "Nếu **{email}** có tài khoản, mã 6 số đã được gửi tới email này. Xem cả mục thư rác." Luôn hiện câu này, kể cả khi email chưa có tài khoản (account.md BR-13); không có lỗi "email không tồn tại" |
| Ô mã | `OtpInput` "Mã xác nhận" như 3.3. **Khác 3.3: đủ 6 số không tự gửi**, focus chuyển sang ô "Mật khẩu mới" (Cognito chỉ kiểm mã cùng lúc với mật khẩu mới, xem mục 8 Đã chốt 12/11) |
| Mật khẩu mới | `PasswordField`, `autocomplete="new-password"`, kèm danh sách điều kiện như 3.2 |
| Nhập lại mật khẩu mới | `PasswordField`, `autocomplete="new-password"`; lỗi "Mật khẩu nhập lại không khớp." |
| Nút | "Đặt lại mật khẩu" → "Đang lưu…" |
| Gửi lại | như 3.3: "Gửi lại mã"; xong `Alert success` "Đã gửi mã mới.", xoá số đã gõ, focus ô mã; mật khẩu đã gõ giữ nguyên |
| Chân thẻ | "Sai email? **Nhập lại email**" → về bước 1, giữ email |

Thứ tự Tab bước 2: ô mã → Mật khẩu mới → Nhập lại mật khẩu mới → "Đặt lại mật khẩu" → "Gửi lại mã" → "Nhập lại email" (nút con mắt không nằm trong thứ tự Tab).

Thành công: chuyển sang `/login` thay cho trang hiện tại (`replace`, nút Back không quay lại form đặt lại), mang theo `from`, `reason`, `email` và `notice` "Đã đặt mật khẩu mới. Đăng nhập bằng mật khẩu mới." (3.1). Không tự đăng nhập: tài khoản có MFA hoặc chưa xác nhận email đi đúng luồng 3.1 sẵn có.

## 4. Trạng thái

Lỗi từ Cognito hiện bằng `Alert danger` ở đầu form (dưới dòng phụ), `role="alert"`, focus vào đó. Lỗi của một ô cụ thể hiện dưới ô đó (design-system §9.4). Câu chữ đề xuất:

| Lỗi Cognito | Câu hiển thị | Ở đâu |
|---|---|---|
| `NotAuthorizedException` (sai email/mật khẩu) | "Email hoặc mật khẩu không đúng." (không nói rõ sai cái nào) | Alert |
| `UserNotConfirmedException` khi đăng nhập | chuyển sang bước nhập mã (3.3) và tự gửi lại mã | — |
| `UsernameExistsException` (trùng email) | "Email này đã có tài khoản." + link "Đăng nhập" | dưới ô Email |
| Trùng username (cách Cognito báo lỗi này do An chọn) | "Username này đã có người dùng." | dưới ô Username |
| `InvalidPasswordException` | "Mật khẩu chưa đạt điều kiện bên dưới." | dưới ô Mật khẩu |
| `CodeMismatchException` | "Mã không đúng. Kiểm tra lại email mới nhất." | dưới 6 ô; xoá 6 số, 6 ô viền `--fg-danger`, focus về ô đầu; gõ số mới thì lỗi tắt |
| `ExpiredCodeException` | "Mã đã hết hạn. Bấm Gửi lại mã." | dưới 6 ô, như dòng trên |
| `LimitExceededException`, `TooManyRequestsException` | "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại." | Alert |
| Lỗi mạng | "Không kết nối được máy chủ, vui lòng thử lại." | Alert |

Ở bước 2 của 3.4 dùng lại các dòng trên: `CodeMismatchException`, `ExpiredCodeException` như 3.3 (xoá số, focus ô mã) nhưng mật khẩu đã gõ giữ nguyên; `InvalidPasswordException` dưới ô "Mật khẩu mới"; `LimitExceededException` (gửi mã hoặc nhập sai quá nhiều) là Alert "Bạn thử quá nhiều lần…". Tài khoản chưa xác nhận email bấm quên mật khẩu: chưa thử trên dev, câu chữ chốt khi làm trang (#439).

Kiểm tra trước khi gửi (ở trình duyệt): ô trống ("Vui lòng nhập username", "Vui lòng nhập email"), username sai ký tự, email sai dạng ("Email không hợp lệ"), mật khẩu chưa đạt điều kiện, nhập lại không khớp. Đang gửi: nút `aria-busy`, các ô `readOnly`.

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| ≥640 | Như mục 2 |
| <640 | Thẻ tràn ngang (chỉ còn lề `--gutter` 16px), padding `24px 16px`, cách header 16px; ô nhập chữ 16px |

## 6. Trợ năng
- Một `<h1>` mỗi màn; khi đổi sang bước nhập mã (3.3, bước 2 của 3.4), focus vào `<h1>` mới (`tabIndex={-1}`).
- Mọi ô có `<label>` hiển thị (không dùng placeholder thay nhãn).
- Nút hiện/ẩn mật khẩu: icon theo **trạng thái** của mật khẩu (11/11/2026): đang ẩn → mắt nhắm (`EyeClosed`), bấm vào → mắt mở (`Eye`) và mật khẩu hiện ra. `aria-label` nói việc nút sẽ làm: "Hiện mật khẩu" khi đang ẩn, "Ẩn mật khẩu" khi đang hiện; `aria-pressed` = mật khẩu đang hiện. Không làm mất focus khỏi ô. **Không nằm trong thứ tự Tab** (`tabIndex={-1}`, sửa 10/11/2026): gõ mật khẩu xong bấm Tab là tới nút gửi form. Chuột, chạm và chế độ duyệt của trình đọc màn hình vẫn bấm được. Đánh đổi: người chỉ dùng bàn phím không mở được chữ mật khẩu; chấp nhận vì đây là tiện ích, không phải bước bắt buộc.
- Ô mã 6 số: trình đọc màn hình chỉ thấy **một** ô nhập có nhãn "Mã xác nhận" (hoặc "Mã xác thực") và lỗi nối bằng `aria-describedby`; 6 ô vuông chỉ để nhìn (`aria-hidden`). Ô đang sáng có viền focus như ô nhập thường.
- `autocomplete` đúng như bảng để trình quản lý mật khẩu và mã OTP tự điền hoạt động.

## 7. Ngoài phạm vi
Đăng nhập bằng số điện thoại; passkey; đăng nhập Google/Apple; tài khoản doanh nghiệp; số điện thoại khôi phục tài khoản; tên và họ tách riêng khi đăng ký; điều khoản chương trình hội viên. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md).

## 8. Cần An xác nhận

**Phải làm khi thay trang tạm bằng Cognito (giỏ khách vãng lai, 07/10/2026):**
- Gọi `setTokenProvider(...)` lúc khởi động app (đã có từ trước) và gọi `notifyAuthChanged()` mỗi khi đăng nhập, tạo tài khoản xong, đăng xuất, hoặc token hết hạn không làm mới được.
- Sau khi đăng nhập **và** sau khi tạo tài khoản + xác nhận mã: `await continueAfterSignIn(navigate, queryClient, from)` thay cho `navigate(from)`.
- Link qua lại giữa `/login` và `/register` giữ nguyên `state` (`from`, `reason`).
- Nút tài khoản trên header (design-system §9.17, đã code ở `app/AccountMenu.tsx`) đọc tên và quyền từ `token.ts`. Lúc khởi động app gọi thêm:
  - `setProfileProvider(() => ({ username, email, isAdmin }))`: đọc từ ID token (username theo thuộc tính An chọn, `isAdmin` = có nhóm `admin` trong `cognito:groups`); trả `null` khi chưa đăng nhập.
  - `setSignOutHandler(() => <đăng xuất Cognito>)`: menu gọi `signOut()`, hàm này chạy handler rồi tự gọi `notifyAuthChanged()`.
- Khi đăng xuất: web tự xoá giỏ khách (`shop-ai:guest-cart`), dữ liệu phiên trong `sessionStorage`, giỏ và đơn trong bộ nhớ đệm (`AccountMenu.tsx`, account.md BR-09). Trang đăng nhập không phải làm gì thêm.
- Thử lại luồng: chưa đăng nhập thêm 2 món → Giỏ → "Đặt hàng" → tạo tài khoản mới → nhập mã → phải tới thẳng `/checkout` với đúng 2 món.

**Trả lời của An (08/10/2026, #69, #71, #73):**
- Tự đăng ký: **có**; xác nhận bằng **mã 6 số gửi email** (email mặc định của Cognito, giới hạn khoảng 50 email/ngày; đủ cho demo, chuyển sang SES khi cần).
- Chính sách mật khẩu: ít nhất 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt (đúng danh sách điều kiện ở 3.2).
- Đăng nhập bằng **email**; username chỉ để hiển thị, lưu ở `preferred_username`, đọc từ ID token.
- Username: 3–20 ký tự, chữ thường không dấu, số, `.`, `_`. Lambda Pre sign-up chặn sai luật và trùng; web nhận lỗi `UserLambdaValidationException` có mã `USERNAME_TAKEN`, `USERNAME_INVALID`, `USERNAME_REQUIRED` và hiện câu ở mục 4.
- **Quên mật khẩu**: có từ bản sau v1.0.0, xem 3.4 và mục Đã chốt 11/11.
- **Admin** đăng nhập chung `/login`; tài khoản đã bật MFA (ứng dụng xác thực, TOTP) thì thêm bước "Xác thực hai lớp". Bắt buộc admin bật MFA làm cùng trang quản trị.
- Token lưu cookie `Secure; SameSite=Strict` (không dùng localStorage). Cấu hình Cognito đọc lúc chạy từ `/config.json`; chạy `vite dev` trên mock (không có `/config.json`) thì vẫn dùng token giả như cũ.
- Chưa có `FocusLayout`: trang đăng nhập tạm nằm trong layout thường như checkout.

**Câu hỏi còn mở:**
- User pool có **tự đăng ký** (self sign-up) và xác nhận bằng **mã gửi email** không? Spec này giả định có.
- Chính sách mật khẩu thật (để viết danh sách điều kiện ở 3.2).
- Admin đăng nhập ở cùng `/login` hay một trang riêng.
- **Username** (đã chốt 07/10/2026: bắt buộc khi đăng ký, dùng làm tên trên header):
  - Khách **đăng nhập bằng email** (như hiện tại) hay bằng username? Spec này giả định email; username chỉ để hiển thị.
  - Lưu username ở thuộc tính nào của user pool (`preferred_username` hay thuộc tính riêng), và cách kiểm tra trùng.
  - Quy tắc ký tự và độ dài (đề xuất ở 3.2).
  - Web đọc username từ đâu sau khi đăng nhập (ID token) để hiện lên header.

**Đã chốt (07/10/2026):** đăng xuất nằm trong menu tài khoản trên header (design-system §9.17). Khi đăng xuất: gọi `notifyAuthChanged()`, xoá giỏ khách (`shop-ai:guest-cart`) và dữ liệu phiên trên trình duyệt, đang ở trang bắt buộc đăng nhập thì về `/` (sửa 08/10/2026 cho khớp account.md BR-09).

**Đã chốt (11/11/2026, An):** làm quên mật khẩu cho bản sau `v1.0.0`, chỉ trên `develop` (#438 tài liệu, #439 web). Xong thì về `/login` và điền sẵn email; tài khoản có TOTP đi đúng luồng đăng nhập hiện có. Giữ mẫu thư tiếng Anh mặc định của Cognito, không sửa infra. Không cho biết email có tài khoản hay không (`preventUserExistenceErrors`, bước 2 của 3.4). Thử trên dev 11/11: đặt lại mật khẩu không đăng xuất thiết bị khác, nên đăng xuất mọi thiết bị làm ở PR infra riêng của Nhân (threat-model.md L9); trang web không phải làm gì thêm.

**Đã chốt (12/11/2026, Hoàng): ô mã ở bước 2 của 3.4 không tự gửi và không kiểm riêng.** Cognito không có lệnh chỉ kiểm mã đặt lại mật khẩu: `ConfirmForgotPassword` (Amplify `confirmResetPassword`) nhận mã cùng mật khẩu mới và đổi mật khẩu ngay khi mã đúng. Vì vậy web không biết mã đúng hay sai trước khi khách gõ mật khẩu mới. Các cách đã cân nhắc và bỏ:

- Gửi kèm một mật khẩu tạm để thử mã: mã đúng thì mật khẩu tài khoản bị đổi thật sang mật khẩu tạm và mã bị dùng mất; khách bỏ dở thì tài khoản mang mật khẩu không ai biết.
- Gửi kèm mật khẩu cố ý sai luật để xem Cognito báo lỗi mã hay lỗi mật khẩu: dựa vào thứ tự kiểm lỗi mà tài liệu Cognito không cam kết, và mỗi lần thử tính vào giới hạn nhập sai (dễ ra `LimitExceededException`).
- Tự làm mã đặt lại riêng (tự sinh, lưu, gửi thư, API kiểm mã): phải tự lo hết hạn, giới hạn thử, chống dò mà Cognito đang lo; thêm bảng, Lambda, quyền IAM và đổi contract.
- Đảo thứ tự (mật khẩu mới trước, ô mã cuối, đủ 6 số thì tự gửi): trái thứ tự khách quen (mã trước, mật khẩu sau) và phải đổi thứ tự Tab.

Bù lại: mã sai hoặc hết hạn thì chỉ xoá 6 số và focus lại ô mã, mật khẩu đã gõ giữ nguyên (mục 4), nên khách chỉ gõ lại mã rồi bấm "Đặt lại mật khẩu".

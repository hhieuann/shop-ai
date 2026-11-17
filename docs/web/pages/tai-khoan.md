# Tài khoản `/account`, `/account/password`

Code: `features/account/pages/AccountInfoPage.tsx`, `ChangePasswordPage.tsx`, `features/account/components/AccountLayout.tsx` (chưa có). Nghiệp vụ: [account.md](../../business/account.md) BR-06, BR-09, BR-13, BR-14. Trang quên mật khẩu khi đang đăng nhập: [dang-nhap.md](dang-nhap.md) 3.4. Đọc kèm [design-system.md](../design-system.md) (§9.3, §9.4, §9.13, §9.17, §9.22, §9.27).

Bản chốt 16/11/2026. Sửa 17/11/2026 theo An: đổi mật khẩu xong thì đăng xuất mọi nơi (3.2); API đổi username theo #471 (mục 1, 4); quên mật khẩu khi đang đăng nhập (mục 8). Trang cho khách đã đăng nhập: xem email, đổi username, đổi mật khẩu, đăng xuất. Bố cục theo trang tài khoản của trang tham khảo chính (cột mục bên trái, nội dung bên phải); màu, chữ, bo góc dùng token Black Magic sẵn có, thêm một token ở design-system §10. Bản mẫu: `pr-drafts/mau-tai-khoan/` (spec là chuẩn, ảnh chỉ để nhìn bố cục).

## 1. Đường dẫn và dữ liệu

| Đường dẫn | Mục |
|---|---|
| `/account` | Thông tin tài khoản: username (sửa được), email (chỉ xem) |
| `/account/password` | Đổi mật khẩu |

- **Bắt buộc đăng nhập.** Chưa đăng nhập mà mở hai đường dẫn này thì sang `/login` với `state.from` là đường dẫn đang mở, như `/orders`. Đăng nhập xong quay lại đúng mục.
- Username và email đọc từ hồ sơ đang có (`useAccount()`, `shared/auth/useSession`; nguồn là ID token, dang-nhap.md mục 8). Không gọi API để hiện trang.
- **Đổi username:** `PATCH /api/v1/me` với `{ "username": "..." }` (account.md BR-06; API của An, issue #471, PR #472 đã merge 17/11, có trong `contracts/openapi.yaml`). Kết quả 200 trả `{ username }`. Thành công thì web **làm mới phiên** bằng `refreshProfile()` của `shared/auth` (lấy ID token mới có `preferred_username` mới, rồi `notifyAuthChanged()`) để header, menu tài khoản và cột trái hiện tên mới.
- **Đổi mật khẩu:** gọi thẳng Cognito qua `shared/auth` (`changePassword`, bản Cognito dùng `updatePassword` của Amplify: mật khẩu hiện tại + mật khẩu mới), không qua API của shop. Đổi xong thì **đăng xuất mọi nơi** (`signOut({ global: true })`) và về `/login` (account.md BR-14, mục 3.2).
- Không có trang tổng quan riêng: `/account` là mục đầu tiên.

## 2. Bố cục

```
[ Header đầy đủ (cả hàng 2) ]
Trang chủ › Tài khoản
┌ Cột trái 280px ─────────┐  ┌ Nội dung ──────────────────────────────────────┐
│ (H) hoangnm             │  │ Thông tin tài khoản (H1)                        │
│     hoangnm@example.com │  │ Username là tên hiện trên header. Email …      │
│─────────────────────────│  │ Username                  Email                 │
│ ▣ Thông tin tài khoản   │  │ [hoangnm            ]     [hoangnm@example.com] │
│   Đổi mật khẩu          │  │ 3–20 ký tự: chữ thường …                        │
│   Đơn hàng của tôi      │  │                                   [ Cập nhật ]  │
│ ─────────────────────── │  │ ─────────────────────────────────────────────── │
│   Đăng xuất             │  │ Mật khẩu                         [Đổi mật khẩu] │
└─────────────────────────┘  │ Nên đổi khi nghi người khác biết mật khẩu …     │
                             └─────────────────────────────────────────────────┘
[ Footer ]
```

| Phần | Giá trị |
|---|---|
| Khung | `RootLayout` header đầy đủ, hàng 2 luôn hiện như các trang khác (không thu lại khi cuộn, design-system §9.1). Nội dung rộng tối đa **1280px**, căn giữa trong lề `--gutter`, như giỏ hàng, đơn hàng; dưới cùng cách footer 48px |
| Đường dẫn | `Breadcrumb` (§9.22): "Trang chủ › Tài khoản" ở `/account`; "Trang chủ › Tài khoản › Đổi mật khẩu" ở `/account/password` ("Tài khoản" là link về `/account`) |
| Lưới (≥1280) | `grid-template-columns: 280px minmax(0,1fr); gap: 24px; align-items: start` |
| Hai khối | nền `--bg-surface`, viền 1px `--border-divider`, bo `--radius-2xl` (16px), không bóng |
| Cột trái | `AccountNav` (design-system §9.27): đầu khối có avatar chữ cái, username, email; dưới là danh sách mục. Không dính khi cuộn (trang ngắn) |
| Khối nội dung | `<section aria-labelledby>` trỏ vào `<h1>`; padding 32px (<1280: 24px; <640: `24px 16px`) |
| Tiêu đề | `<h1>` 24/32/600 `--fg-heading` (<640: 20/28); dòng phụ 14/20 `--fg-subdued`, cách 4px; phần dưới cách dòng phụ 24px |

## 3. Các mục

### 3.1 Thông tin tài khoản `/account`

| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Thông tin tài khoản" |
| Dòng phụ | "Username là tên hiện trên header. Email dùng để đăng nhập." |
| Lưới ô | 2 cột bằng nhau, gap `16px 24px` (<768: 1 cột, gap 16px). Ô `Field` cỡ **48px**, chữ trong ô 16/24 |
| Username | `Field` nhãn "Username", `autocomplete="nickname"`, `autoCapitalize="none"`, `spellCheck={false}`, `maxLength={20}`; nền `--bg-surface`, viền `--border-input` như ô nhập thường. Giá trị ban đầu là username hiện tại. Gợi ý dưới ô (12/18 `--fg-subdued`): "3–20 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới." |
| Email | `Field` nhãn "Email", `type="email"`, **`readOnly`** (không `disabled`, để vẫn chọn, chép được và trình đọc màn hình đọc được). Ô chỉ đọc: nền `--bg-surface-raised`, viền `--border-divider`, chữ `--fg-subdued`, con trỏ mặc định; focus vẫn có viền focus 2px. Không có dòng chữ giải thích bên dưới |
| Nút "Cập nhật" | `Button primary lg`, nằm **sát phải**, cách lưới ô 24px, ngay trên phần Mật khẩu (<640: rộng 100%). Đây là nút `primary` duy nhất của mục này |
| Phần Mật khẩu | viền trên 1px `--border-divider`, cách nút "Cập nhật" 24px, padding trên 24px; hàng flex `space-between`, gap 16px, xuống dòng được: trái là `<h2>` "Mật khẩu" 16/24/600 `--fg-heading` + câu 14/20 `--fg-subdued` "Nên đổi khi nghi người khác biết mật khẩu của bạn." (cách 2px); phải là link `/account/password` kiểu `Button secondary md` (`buttonClass`), icon `KeyRound` 18 + "Đổi mật khẩu" (<640: rộng 100%) |

**Nút "Cập nhật" theo nội dung ô Username** (giá trị so sánh là chữ trong ô, không bỏ khoảng trắng):

| Ô Username | Nút | Ghi chú |
|---|---|---|
| Giống username hiện tại (chưa sửa, hoặc sửa rồi gõ lại như cũ) | **vô hiệu kiểu tím nhạt**: nền `--bg-primary-tint-2`, viền `--bg-primary-tint-2`, chữ `--fg-primary-disabled` (token mới, §10), `cursor: not-allowed` | `disabled` |
| Khác username hiện tại, đúng luật | nút chính bình thường, bấm được | Enter trong ô cũng gửi |
| **Trống** | vô hiệu kiểu tím nhạt; ô viền `--fg-danger` và dòng lỗi "Vui lòng nhập username." hiện **ngay khi ô thành trống** (không chờ rời ô hay bấm nút) | `aria-invalid="true"` |
| Khác username hiện tại nhưng sai luật (chữ hoa, dấu, khoảng trắng, ký tự khác, dưới 3 ký tự) | bấm được; bấm thì không gửi API mà hiện lỗi "Username chưa đúng quy tắc bên dưới." dưới ô, focus vào ô | kiểm ở trình duyệt theo `USERNAME_PATTERN` (account.md BR-06) |
| Đang gửi | `aria-busy`, chữ "Đang cập nhật…", giữ bề rộng (§9.3); ô Username `readOnly` | |

Kiểu vô hiệu tím nhạt **chỉ dùng cho nút "Cập nhật"** của trang này (nút lưu khi chưa có gì thay đổi). Nút chính vô hiệu ở trang khác giữ `opacity .4` (design-system §6).

Thành công (200): `Alert success` "Đã cập nhật username." ngay dưới dòng phụ (`role="status"`); ô giữ tên mới, tên mới thành "username hiện tại" nên nút về tím nhạt; header, menu tài khoản và cột trái đổi theo sau khi làm mới phiên (mục 1). Sửa ô lần nữa thì Alert tắt.

### 3.2 Đổi mật khẩu `/account/password`

| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Đổi mật khẩu" |
| Dòng phụ | "Đổi xong, mọi thiết bị đều đăng xuất, kể cả máy này. Đăng nhập lại bằng mật khẩu mới." |
| Form | rộng tối đa **480px** (<640: hết khối), ô xếp dọc cách nhau 16px, ô `PasswordField` cỡ **48px** (design-system §9.4) |
| Mật khẩu hiện tại | `PasswordField`, `autocomplete="current-password"` |
| Quên mật khẩu hiện tại | link 12/18/500 `--fg-primary` ngay dưới ô (cách 8px), căn trái: "Quên mật khẩu hiện tại?" → `/forgot-password`. Trang quên mật khẩu khoá ô email theo email của tài khoản (dang-nhap.md 3.4, phần "Khi đang đăng nhập") |
| Mật khẩu mới | `PasswordField`, `autocomplete="new-password"`, kèm **danh sách 5 điều kiện** như dang-nhap.md 3.2 (`PasswordRules`) |
| Nhập lại mật khẩu mới | `PasswordField`, `autocomplete="new-password"`; lỗi "Mật khẩu nhập lại không khớp." |
| Nút | `Button primary lg` "Đổi mật khẩu", căn trái dưới form, cách ô cuối 24px (<640: rộng 100%); đang gửi "Đang đổi mật khẩu…" |

Thứ tự Tab: Mật khẩu hiện tại → "Quên mật khẩu hiện tại?" → Mật khẩu mới → Nhập lại mật khẩu mới → nút "Đổi mật khẩu" (nút con mắt không nằm trong thứ tự Tab, §9.4).

Kiểm trước khi gửi: ô trống ("Vui lòng nhập mật khẩu hiện tại.", "Vui lòng nhập mật khẩu mới."), mật khẩu mới chưa đạt điều kiện ("Mật khẩu chưa đạt điều kiện bên dưới."), nhập lại không khớp. Lỗi đầu tiên được focus.

Thành công (account.md BR-14, sửa 17/11/2026):
1. Đăng xuất mọi nơi: `signOut({ global: true })`, dọn dữ liệu phiên như "Đăng xuất" ở 3.3 (giỏ khách, dữ liệu phiên, bộ nhớ đệm) và gọi `notifyAuthChanged()`. Nút giữ "Đang đổi mật khẩu…" tới lúc chuyển trang.
2. Chuyển sang `/login` thay cho trang hiện tại (`replace`), mang theo `email` (email của tài khoản), `from: '/account'` và `notice` "Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới." Trang đăng nhập điền sẵn email, hiện Alert và focus vào ô Mật khẩu (dang-nhap.md 3.1). Không có Alert thành công trên trang đổi mật khẩu.
3. Chuyển trang này không được bị bước "chưa đăng nhập thì sang `/login`" của trang tài khoản (mục 1) đè mất `email` và `notice`.

Mật khẩu đã đổi nhưng bước đăng xuất mọi nơi lỗi (mạng): vẫn xoá phiên trên máy này và sang `/login` như trên, vì mật khẩu cũ đã hết dùng được.

### 3.3 Cột trái và đăng xuất

| Mục | Icon | Tới |
|---|---|---|
| Thông tin tài khoản | `UserRound` | `/account` |
| Đổi mật khẩu | `KeyRound` | `/account/password` |
| Đơn hàng của tôi | `Package` | `/orders` (rời khỏi trang tài khoản) |
| (đường kẻ) | | |
| Đăng xuất | `LogOut` | đăng xuất như menu tài khoản (§9.17, account.md BR-09): xoá dữ liệu phiên, gọi `notifyAuthChanged()`, về `/` |

Mục của trang đang xem có `aria-current="page"`. Đăng xuất không hỏi lại (giống menu tài khoản).

## 4. Trạng thái

Lỗi của một ô hiện dưới ô đó (§9.4); lỗi chung hiện bằng `Alert danger` dưới dòng phụ, `role="alert"`, focus vào đó.

**Đổi username** (`PATCH /api/v1/me`, `application/problem+json` có `code`):

| Lỗi | Câu hiển thị | Ở đâu |
|---|---|---|
| 409 `USERNAME_TAKEN` | "Username này đã có người dùng." (cùng câu với tạo tài khoản) | dưới ô Username, ô viền đỏ, focus vào ô; gõ tiếp thì lỗi tắt |
| 400 `USERNAME_INVALID` / `USERNAME_REQUIRED` | như kiểm ở trình duyệt (3.1) | dưới ô Username |
| 400 không có `code` (body không phải JSON; web gửi đúng thì không gặp) | "Không cập nhật được username, vui lòng thử lại." | Alert |
| 401 | phiên hết hạn: sang `/login` với `state.from` như các trang cần đăng nhập | — |
| Lỗi mạng, 5xx | "Không kết nối được máy chủ, vui lòng thử lại." | Alert |

**Đổi mật khẩu** (lỗi Cognito):

| Lỗi Cognito | Câu hiển thị | Ở đâu |
|---|---|---|
| `NotAuthorizedException` (sai mật khẩu hiện tại) | "Mật khẩu hiện tại không đúng." | dưới ô Mật khẩu hiện tại; xoá ô đó, focus vào; hai ô mật khẩu mới giữ nguyên |
| `InvalidPasswordException` | "Mật khẩu chưa đạt điều kiện bên dưới." | dưới ô Mật khẩu mới |
| `LimitExceededException`, `TooManyRequestsException` | "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại." | Alert |
| Phiên hết hạn (không làm mới được token) | sang `/login` với `state.from` | — |
| Lỗi mạng | "Không kết nối được máy chủ, vui lòng thử lại." | Alert |

Câu lỗi Cognito dùng chung `features/auth/lib/authErrors.ts` nếu đã có câu; thêm câu "Mật khẩu hiện tại không đúng." cho riêng màn này (không dùng "Email hoặc mật khẩu không đúng." vì khách đã đăng nhập).

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| ≥1280 | Như mục 2 |
| <1280 | Bỏ cột trái. Trên khối nội dung là **nút "Đổi mục"** (design-system §9.27): hiện mục đang xem, bấm mở bảng chọn mục từ dưới lên. Khối nội dung padding 24px |
| <768 | Lưới ô ở 3.1 còn 1 cột |
| <640 | Khối nội dung padding `24px 16px`, `<h1>` 20/28; nút "Cập nhật", "Đổi mật khẩu" (cả link ở phần Mật khẩu) rộng 100%; form đổi mật khẩu rộng hết khối; chữ trong ô 16px |

## 6. Trợ năng

- Một `<h1>` mỗi mục; khối nội dung là `<section aria-labelledby>`.
- Cột trái là `<nav aria-label="Tài khoản">`; mục hiện tại `aria-current="page"`; "Đăng xuất" là `<button>`.
- Ô Email `readOnly` (không `disabled`): vẫn Tab tới, đọc được giá trị.
- Nút "Cập nhật" vô hiệu dùng `disabled` thật. Lý do vô hiệu đã nằm ở ô (giá trị chưa đổi, hoặc dòng lỗi "Vui lòng nhập username." nối bằng `aria-describedby`), nên không thêm chú thích riêng.
- Dòng gợi ý và dòng lỗi dưới ô Username đều nối vào ô bằng `aria-describedby` (lỗi trước, gợi ý sau).
- Alert thành công `role="status"`; Alert lỗi `role="alert"`. Sau khi cập nhật username thành công, focus giữ ở ô Username (nút vừa bấm đã vô hiệu).
- Nút "Đổi mục" và bảng chọn mục: §9.27.

## 7. Ngoài phạm vi

Ảnh đại diện; họ tên, số điện thoại, ngày sinh, giới tính; sổ địa chỉ; đổi email; bật xác thực hai lớp (BR-10, làm sau); xoá tài khoản; "Liên hệ hỗ trợ"; nút riêng "Đăng xuất khỏi mọi thiết bị" (đổi mật khẩu đã đăng xuất mọi nơi, 3.2); lịch sử đăng nhập. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md) và account.md BR-11.

## 8. Đã chốt với An (17/11/2026)

- **`PATCH /api/v1/me`** (#471, account.md BR-06): 400 `USERNAME_REQUIRED` hoặc `USERNAME_INVALID` (gửi số hay mảng cũng là `USERNAME_INVALID`); body không phải JSON thì 400 không có `code`; 409 `USERNAME_TAKEN`; đổi sang đúng tên đang dùng thì 200 và không ghi gì; kết quả `{ username }`, `Cache-Control: no-store`. Web làm mới phiên bằng `refreshProfile()` (mục 1).
- **Đổi mật khẩu xong thì đăng xuất mọi nơi, gồm cả máy đang dùng** (BR-14, 3.2). Lý do: khách thường đổi mật khẩu vì nghi bị lộ; giữ phiên cũ thì người lạ đã đăng nhập vẫn dùng tiếp được. Khớp BR-13 (L9), không cần thêm Lambda.
- **"Quên mật khẩu hiện tại?" khi đang đăng nhập:** trang quên mật khẩu chạy bình thường (không đẩy về trang trước như `/login`), khoá ô email theo email của tài khoản; đặt lại xong thì **đăng xuất máy này thật** rồi mới sang `/login`, vì access token còn hạn tới 1 giờ, không đăng xuất thì `/login` đẩy về trang trước. Chi tiết ở dang-nhap.md 3.4.
- Giới hạn đã biết: gọi thẳng Cognito bằng access token vẫn đổi được `preferred_username` và email (BR-06). Nhân ghi vào threat model.
- Bật xác thực hai lớp cho khách: làm sau.

## 9. Việc còn lại

- Token `--fg-primary-disabled` (design-system §10), thêm vào `tokens.css` cùng PR làm trang.
- Route `/account`, `/account/password` trong `router.tsx`; thêm `/account` vào danh sách trang bắt buộc đăng nhập của `AccountMenu` (đăng xuất ở đây thì về `/`).
- Menu tài khoản thêm mục "Tài khoản của tôi" (design-system §9.17).
- Làm theo hai PR web: khung trang, cột mục, đổi mật khẩu, quên mật khẩu khi đang đăng nhập, mục menu trước (không cần backend); đổi username sau (API đã có từ PR #472 của An). Giữa hai PR, ô Username tạm là ô chỉ đọc như Email và chưa có nút "Cập nhật".

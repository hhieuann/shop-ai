# Tài khoản `/account`, `/account/password`, `/account/two-factor`

Code: `features/account/pages/AccountInfoPage.tsx`, `ChangePasswordPage.tsx`, `features/account/components/AccountLayout.tsx` (chưa có), `features/account/pages/TwoFactorPage.tsx`. Nghiệp vụ: [account.md](../../business/account.md) BR-06, BR-09, BR-10, BR-13, BR-14. Trang quên mật khẩu khi đang đăng nhập: [dang-nhap.md](dang-nhap.md) 3.4. Đọc kèm [design-system.md](../design-system.md) (§9.3, §9.4, §9.7, §9.13, §9.14, §9.17, §9.22, §9.27, §9.28).

Bản chốt 16/11/2026. Sửa 17/11/2026 theo An: đổi mật khẩu xong thì đăng xuất mọi nơi (3.2); API đổi username theo #471 (mục 1, 4); quên mật khẩu khi đang đăng nhập (mục 8). Sửa 18/11/2026 theo An: xác thực hai lớp (3.1, 3.4, 3.5; account.md BR-10). Trang cho khách đã đăng nhập: xem email, đổi username, đổi mật khẩu, đăng xuất. Bố cục theo trang tài khoản của trang tham khảo chính (cột mục bên trái, nội dung bên phải); màu, chữ, bo góc dùng token Black Magic sẵn có, thêm một token ở design-system §10. Bản mẫu: `pr-drafts/mau-tai-khoan/` (spec là chuẩn, ảnh chỉ để nhìn bố cục).

## 1. Đường dẫn và dữ liệu

| Đường dẫn | Mục |
|---|---|
| `/account` | Thông tin tài khoản: username (sửa được), email (chỉ xem) |
| `/account/password` | Đổi mật khẩu |
| `/account/two-factor` | Bật xác thực hai lớp (mở từ nút "Bật" ở `/account`; không có mục riêng ở cột trái) |

- **Bắt buộc đăng nhập.** Chưa đăng nhập mà mở các đường dẫn này thì sang `/login` với `state.from` là đường dẫn đang mở, như `/orders`. Đăng nhập xong quay lại đúng mục.
- Username và email đọc từ hồ sơ đang có (`useAccount()`, `shared/auth/useSession`; nguồn là ID token, dang-nhap.md mục 8). Không gọi API để hiện trang.
- **Đổi username:** `PATCH /api/v1/me` với `{ "username": "..." }` (account.md BR-06; API của An, issue #471, PR #472 đã merge 17/11, có trong `contracts/openapi.yaml`). Kết quả 200 trả `{ username }`. Thành công thì web **làm mới phiên** bằng `refreshProfile()` của `shared/auth` (lấy ID token mới có `preferred_username` mới, rồi `notifyAuthChanged()`) để header, menu tài khoản và cột trái hiện tên mới.
- **Đổi mật khẩu:** gọi thẳng Cognito qua `shared/auth` (`changePassword`, bản Cognito dùng `updatePassword` của Amplify: mật khẩu hiện tại + mật khẩu mới), không qua API của shop. Đổi xong thì **đăng xuất mọi nơi** (gọi thẳng Cognito `GlobalSignOut`, #481) và về `/login` (account.md BR-14, mục 3.2).
- **Xác thực hai lớp:** gọi thẳng Cognito qua `shared/auth`, không qua API của shop. Bản Cognito dùng `fetchMFAPreference` (đọc trạng thái khi mở `/account`), `setUpTOTP` (tạo mã; URI `otpauth://` tự dựng, mã hoá nhãn và issuer), `verifyTOTPSetup` (xác nhận mã) và `updateMFAPreference` (bật: `{ totp: 'PREFERRED' }` ngay sau `verifyTOTPSetup`, vì user pool để MFA tuỳ chọn nên chỉ xác nhận mã thì lần đăng nhập sau chưa hỏi mã; tắt: `{ totp: 'DISABLED' }`) của Amplify; các hàm này nằm ở chunk riêng, chỉ nạp khi cần. Bản mock (chạy `vite dev` không có Cognito): mã giả, mã "000000" là sai, 6 số khác là đúng; trạng thái ghi `localStorage`.
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
| Đường dẫn | `Breadcrumb` (§9.22): "Trang chủ › Tài khoản" ở `/account`; "Trang chủ › Tài khoản › Đổi mật khẩu" ở `/account/password`; "Trang chủ › Tài khoản › Xác thực hai lớp" ở `/account/two-factor` ("Tài khoản" là link về `/account`) |
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
| Phần Xác thực hai lớp | dưới phần Mật khẩu, cùng kiểu: viền trên 1px `--border-divider`, cách 24px, padding trên 24px; hàng flex `space-between`, gap 16px, xuống dòng được. Trái: `<h2>` "Xác thực hai lớp" 16/24/600 `--fg-heading` và `Badge` (§9.7) cùng hàng, cách 8px: "Đang bật" (`success`) hoặc "Đang tắt" (`neutral`); dưới là câu 14/20 `--fg-subdued` (cách 2px): đang tắt "Nhập thêm mã 6 số từ ứng dụng xác thực mỗi lần đăng nhập.", đang bật "Đăng nhập cần mã 6 số từ ứng dụng xác thực." Phải: đang tắt là link `/account/two-factor` kiểu `Button secondary md` (`buttonClass`), icon `ShieldCheck` 18 + "Bật"; đang bật là `Button secondary md` "Tắt" (mở hộp thoại, 3.5). <640: nút rộng 100% |
| Đang đọc trạng thái | chưa biết bật hay tắt: không có nhãn và nút, câu 14/20 `--fg-subdued` "Đang kiểm tra…"; hàng giữ cao bằng lúc có nút (không nhảy bố cục) |
| Đọc trạng thái lỗi | câu 14/20 `--fg-subdued` "Không tải được trạng thái, vui lòng tải lại trang.", không có nhãn, không có nút |

**Nút "Cập nhật" theo nội dung ô Username** (giá trị so sánh là chữ trong ô, không bỏ khoảng trắng):

| Ô Username | Nút | Ghi chú |
|---|---|---|
| Giống username hiện tại (chưa sửa, hoặc sửa rồi gõ lại như cũ) | **vô hiệu kiểu tím nhạt**: nền `--bg-primary-tint-2`, viền `--bg-primary-tint-2`, chữ `--fg-primary-disabled` (token mới, §10), `cursor: not-allowed` | `disabled` |
| Khác username hiện tại, đúng luật | nút chính bình thường, bấm được | Enter trong ô cũng gửi |
| **Trống** | vô hiệu kiểu tím nhạt; ô viền `--fg-danger` và dòng lỗi "Vui lòng nhập username." hiện **ngay khi ô thành trống** (không chờ rời ô hay bấm nút) | `aria-invalid="true"` |
| Khác username hiện tại nhưng sai luật (chữ hoa, dấu, khoảng trắng, ký tự khác, dưới 3 ký tự) | bấm được; bấm thì không gửi API mà hiện lỗi "Username chưa đúng quy tắc bên dưới." dưới ô, focus vào ô | kiểm ở trình duyệt theo `USERNAME_PATTERN` (account.md BR-06) |
| Đang gửi | `aria-busy`, chữ "Đang cập nhật…", giữ bề rộng (§9.3); ô Username `readOnly` | |

Kiểu vô hiệu tím nhạt **chỉ dùng cho nút "Cập nhật"** của trang này (nút lưu khi chưa có gì thay đổi). Nút chính vô hiệu ở trang khác giữ `opacity .4` (design-system §6).

Câu báo sau khi bật, tắt xác thực hai lớp (3.4, 3.5) cũng hiện ở chỗ Alert này.

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
1. Đăng xuất mọi nơi: gọi thẳng Cognito `GlobalSignOut` (`shared/auth/cognito.ts`), dọn dữ liệu phiên như "Đăng xuất" ở 3.3 (giỏ khách, dữ liệu phiên, bộ nhớ đệm) và gọi `notifyAuthChanged()`. Nút giữ "Đang đổi mật khẩu…" tới lúc chuyển trang.
2. Chuyển sang `/login` thay cho trang hiện tại (`replace`), mang theo `email` (email của tài khoản), `from: '/account'` và `notice` "Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới." Trang đăng nhập điền sẵn email, hiện Alert và focus vào ô Mật khẩu (dang-nhap.md 3.1). Không có Alert thành công trên trang đổi mật khẩu.
3. Chuyển trang này không được bị bước "chưa đăng nhập thì sang `/login`" của trang tài khoản (mục 1) đè mất `email` và `notice`.

Mật khẩu đã đổi nhưng bước đăng xuất mọi nơi lỗi (mạng, Cognito từ chối; An chốt 17/11/2026):
1. Ở lại trang, **giữ phiên trên máy này** để thử lại được.
2. Hiện `Alert danger` dưới dòng phụ: "Đã đổi mật khẩu nhưng chưa đăng xuất được các thiết bị khác." kèm nút "Thử lại" (`Button secondary sm` trong Alert); focus vào Alert.
3. Form khoá (ba ô `readOnly`, nút "Đổi mật khẩu" ẩn) vì mật khẩu đã đổi; "Thử lại" chỉ gọi lại đăng xuất mọi nơi, không đổi mật khẩu lần nữa. Đang thử thì nút "Đang thử lại…".
4. Thử lại thành công thì như bước 1, 2 ở trên (sang `/login` kèm câu báo).

Lý do không xoá phiên như trước: đăng xuất mọi nơi là để đuổi người lạ đang dùng mật khẩu cũ; xoá phiên máy này mà chưa thu hồi được phiên máy khác thì khách tưởng đã an toàn. Web tự gọi Cognito `GlobalSignOut` để biết lỗi (`signOut({ global: true })` của Amplify bắt mọi lỗi của bước này rồi vẫn xoá token).

### 3.3 Cột trái và đăng xuất

| Mục | Icon | Tới |
|---|---|---|
| Thông tin tài khoản | `UserRound` | `/account` |
| Đổi mật khẩu | `KeyRound` | `/account/password` |
| Đơn hàng của tôi | `Package` | `/orders` (rời khỏi trang tài khoản) |
| (đường kẻ) | | |
| Đăng xuất | `LogOut` | đăng xuất như menu tài khoản (§9.17, account.md BR-09): xoá dữ liệu phiên, gọi `notifyAuthChanged()`, về `/` |

Mục của trang đang xem có `aria-current="page"`. Đăng xuất không hỏi lại (giống menu tài khoản).

Ở `/account/two-factor` không có mục riêng: "Thông tin tài khoản" giữ trạng thái đang chọn (trang mở từ đó; An chốt 18/11/2026).

### 3.4 Bật xác thực hai lớp `/account/two-factor` (account.md BR-10)

Khung như mục khác (`AccountLayout`, `AccountPanel`). Đã bật rồi mà mở trang này: về `/account` (`replace`).

| Thứ | Nội dung |
|---|---|
| Tiêu đề | "Bật xác thực hai lớp" |
| Dòng phụ | "Mỗi lần đăng nhập, bạn sẽ nhập thêm mã 6 số từ ứng dụng xác thực." |
| Câu cho admin | đến từ `/admin` (admin chưa bật, admin-don-hang.md mục 1): `Alert warning` "Tài khoản quản trị cần bật xác thực hai lớp." dưới dòng phụ, không có nút. Đây chỉ là chặn ở web; bảo vệ thật là An bật MFA cho tài khoản admin trên Cognito (threat model L5) |
| Bước 1 | `<h2>` 16/24/600 `--fg-heading` "1. Thêm tài khoản vào ứng dụng xác thực"; dưới là hàng flex gap 24px, căn trên (<640: xếp dọc) |
| — Mã QR | ô QR (design-system §9.28): 176px, padding 12px, nền `--bg-surface`, viền 1px `--border-divider`, bo `--radius-xl`. Ảnh từ `qrcode` (`toDataURL`, chỉ nạp ở trang này), `alt="Mã QR để thêm tài khoản Black Magic vào ứng dụng xác thực"`. Nội dung QR là URI `otpauth://totp/` với nhãn "Black Magic:{email}" và `issuer=Black Magic`, nhãn và `issuer` mã hoá URL |
| — Bên phải QR | câu 14/20 `--fg-default` "Mở ứng dụng xác thực trên điện thoại và quét mã này." Dưới (cách 8px) câu 14/20 `--fg-subdued` "Không có điện thoại? Dùng ứng dụng xác thực trên máy tính (tiện ích trình duyệt, trình quản lý mật khẩu như Bitwarden, 1Password, KeePassXC) và nhập mã chữ dưới đây." Dưới (cách 12px) **mã chữ** (`sharedSecret`) chia nhóm 4 ký tự, `--font-mono` 14/20, nền `--bg-surface-raised`, bo `--radius-md`, padding `4px 8px`, chọn được; cạnh là `Button ghost sm` icon `Copy` 16 "Chép mã" (chép xong đổi "Đã chép" 2 giây, báo qua `aria-live`). Dưới cùng (cách 8px) link 12/18/500 `--fg-primary` "Mở bằng ứng dụng trên máy này" → URI `otpauth://` (máy có ứng dụng nhận loại link này) |
| Bước 2 | `<h2>` "2. Nhập mã 6 số đang hiện trong ứng dụng", cách bước 1 32px; `OtpInput` (§9.4) nhãn "Mã xác thực", 6 ô, rộng tối đa 360px. **Không tự gửi khi đủ 6 số** (An chốt 18/11/2026): khách bấm nút hoặc Enter |
| Nút | `Button primary lg` "Bật xác thực hai lớp", căn trái, cách ô mã 24px (<640: rộng 100%); đang gửi "Đang bật…". Cạnh là `Button ghost md` "Để sau" → `/account` (đến từ `/admin` cũng về `/account`) |

Đang tạo mã (`setUpTOTP`): chỗ QR và mã chữ là khung chờ cùng cỡ (không nhảy bố cục); nút "Bật xác thực hai lớp" vô hiệu. Tạo mã lỗi: `Alert danger` "Không tạo được mã, vui lòng thử lại." kèm `Button secondary sm` "Thử lại" (trong Alert, §9.13).

Đọc trạng thái lỗi: **không tạo mã** (AssociateSoftwareToken gỡ ngay mã cũ nếu tài khoản đã bật, khách mất ứng dụng xác thực đang dùng); `Alert danger` "Không tải được trạng thái xác thực hai lớp, vui lòng thử lại." kèm `Button secondary sm` "Thử lại" (đọc lại trạng thái); chỗ QR, mã chữ giữ khung chờ, nút "Bật xác thực hai lớp" vô hiệu.

Bấm "Bật xác thực hai lớp": `verifyTOTPSetup({ code })` rồi `updateMFAPreference({ totp: 'PREFERRED' })` (thiếu bước sau thì lần đăng nhập sau Cognito chưa hỏi mã; kiểm trên dev: bật, đăng xuất, đăng nhập lại phải bị hỏi mã). Mã đúng mà bước bật lỗi thì bấm lại chỉ chạy bước bật. Thành công: về `/account` (`replace`) với `Alert success` "Đã bật xác thực hai lớp. Lần đăng nhập sau cần mã 6 số." (mang qua `state.notice`, đọc xong xoá khỏi history như `/login`); phần Xác thực hai lớp hiện "Đang bật". Đến từ `/admin` thì bật xong về `/admin`.

Mã chữ chỉ hiện trên màn hình: không lưu vào trình duyệt, không ghi log (threat model L13). Rời trang rồi mở lại thì tạo mã mới.

### 3.5 Tắt xác thực hai lớp (ở `/account`)

Bấm "Tắt" mở `ConfirmDialog tone="danger"` (§9.14):
- tiêu đề "Tắt xác thực hai lớp?";
- nội dung "Đăng nhập sẽ chỉ cần email và mật khẩu. Tài khoản dễ bị chiếm hơn nếu lộ mật khẩu.";
- nút "Giữ bật" (focus trước) và "Tắt" (`danger`); đang gửi "Đang tắt…".

Xác nhận: `updateMFAPreference({ totp: 'DISABLED' })`. Xong thì đóng hộp thoại, `Alert success` "Đã tắt xác thực hai lớp.", phần Xác thực hai lớp hiện "Đang tắt", focus về nút "Bật". Lỗi: hộp thoại đóng, Alert theo mục 4.

Tắt không hỏi lại mật khẩu hay mã vì Cognito không có API kiểm riêng: ai đang giữ phiên đăng nhập đều tắt được, và Cognito không gửi thư báo (threat model L11, mức Thấp). Tài khoản admin tắt được như khách; lần mở `/admin` sau sẽ bị chuyển về trang bật.

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
| Đã đổi mật khẩu, đăng xuất mọi nơi lỗi | "Đã đổi mật khẩu nhưng chưa đăng xuất được các thiết bị khác." + nút "Thử lại" (3.2) | Alert, form khoá |

**Xác thực hai lớp** (lỗi Cognito):

| Lỗi | Câu hiển thị | Ở đâu |
|---|---|---|
| `CodeMismatchException`, `EnableSoftwareTokenMFAException` (mã sai lúc xác nhận) | "Mã không đúng. Nhập mã đang hiện trong ứng dụng (mã đổi mỗi 30 giây)." | dưới ô mã; xoá 6 số, focus ô đầu |
| Chưa đủ 6 số mà bấm nút | "Nhập đủ 6 số trong ứng dụng." | dưới ô mã |
| `LimitExceededException`, `TooManyRequestsException` | "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại." | Alert |
| Phiên hết hạn (không làm mới được token, token bị thu hồi) | đăng xuất máy này, sang `/login` với `state.from` | — |
| Lỗi mạng, lỗi khác | "Không kết nối được máy chủ, vui lòng thử lại." | Alert |

Câu lỗi Cognito dùng chung `features/auth/lib/authErrors.ts` nếu đã có câu; thêm câu "Mật khẩu hiện tại không đúng." cho riêng màn này (không dùng "Email hoặc mật khẩu không đúng." vì khách đã đăng nhập). Câu của xác thực hai lớp nằm trong hàm riêng `toTwoFactorError`, không sửa câu cũ.

## 5. Responsive

| Màn | Khác biệt |
|---|---|
| ≥1280 | Như mục 2 |
| <1280 | Bỏ cột trái. Trên khối nội dung là **nút "Đổi mục"** (design-system §9.27): hiện mục đang xem, bấm mở bảng chọn mục từ dưới lên. Khối nội dung padding 24px |
| <768 | Lưới ô ở 3.1 còn 1 cột |
| <640 | Khối nội dung padding `24px 16px`, `<h1>` 20/28; nút "Cập nhật", "Đổi mật khẩu" (cả link ở phần Mật khẩu), "Bật", "Tắt", "Bật xác thực hai lớp", "Để sau" rộng 100%; form đổi mật khẩu rộng hết khối; bước 1 ở 3.4 xếp dọc (QR trên, hướng dẫn và mã chữ dưới); chữ trong ô 16px |

## 6. Trợ năng

- Một `<h1>` mỗi mục; khối nội dung là `<section aria-labelledby>`.
- Cột trái là `<nav aria-label="Tài khoản">`; mục hiện tại `aria-current="page"`; "Đăng xuất" là `<button>`.
- Ô Email `readOnly` (không `disabled`): vẫn Tab tới, đọc được giá trị.
- Nút "Cập nhật" vô hiệu dùng `disabled` thật. Lý do vô hiệu đã nằm ở ô (giá trị chưa đổi, hoặc dòng lỗi "Vui lòng nhập username." nối bằng `aria-describedby`), nên không thêm chú thích riêng.
- Dòng gợi ý và dòng lỗi dưới ô Username đều nối vào ô bằng `aria-describedby` (lỗi trước, gợi ý sau).
- Alert thành công `role="status"`; Alert lỗi `role="alert"`. Sau khi cập nhật username thành công, focus giữ ở ô Username (nút vừa bấm đã vô hiệu).
- Nút "Đổi mục" và bảng chọn mục: §9.27.
- Xác thực hai lớp: `Badge` đứng cạnh `<h2>` nên trình đọc màn hình đọc "Xác thực hai lớp, Đang tắt". Ảnh QR có `alt`; mã chữ là văn bản thật (đọc, chép được); "Chép mã" báo "Đã chép" qua vùng `aria-live="polite"`. Hai bước là `<h2>` có số; ô mã nối lỗi bằng `aria-describedby` như `OtpInput`. Hộp thoại tắt dùng `ConfirmDialog` (focus "Giữ bật" trước, Esc đóng, trả focus về nút "Tắt").

## 7. Ngoài phạm vi

Ảnh đại diện; họ tên, số điện thoại, ngày sinh, giới tính; sổ địa chỉ; đổi email; passkey (Cognito không cho passkey làm lớp thứ hai sau mật khẩu, cần gói Essentials; hướng mở rộng); mã dự phòng cho xác thực hai lớp; khách tự khôi phục khi mất thiết bị tạo mã (liên hệ shop, BR-10); xoá tài khoản; "Liên hệ hỗ trợ"; nút riêng "Đăng xuất khỏi mọi thiết bị" (đổi mật khẩu đã đăng xuất mọi nơi, 3.2); lịch sử đăng nhập. Lý do: [ngoai-pham-vi.md](../ngoai-pham-vi.md) và account.md BR-11.

## 8. Đã chốt với An (17/11/2026)

- **`PATCH /api/v1/me`** (#471, account.md BR-06): 400 `USERNAME_REQUIRED` hoặc `USERNAME_INVALID` (gửi số hay mảng cũng là `USERNAME_INVALID`); body không phải JSON thì 400 không có `code`; 409 `USERNAME_TAKEN`; đổi sang đúng tên đang dùng thì 200 và không ghi gì; kết quả `{ username }`, `Cache-Control: no-store`. Web làm mới phiên bằng `refreshProfile()` (mục 1).
- **Đổi mật khẩu xong thì đăng xuất mọi nơi, gồm cả máy đang dùng** (BR-14, 3.2). Lý do: khách thường đổi mật khẩu vì nghi bị lộ; giữ phiên cũ thì người lạ đã đăng nhập vẫn dùng tiếp được. Khớp BR-13 (L9), không cần thêm Lambda.
- **"Quên mật khẩu hiện tại?" khi đang đăng nhập:** trang quên mật khẩu chạy bình thường (không đẩy về trang trước như `/login`), khoá ô email theo email của tài khoản; đặt lại xong thì **đăng xuất máy này thật** rồi mới sang `/login`, vì access token còn hạn tới 1 giờ, không đăng xuất thì `/login` đẩy về trang trước. Chi tiết ở dang-nhap.md 3.4.
- **Đăng xuất mọi nơi lỗi sau khi đã đổi mật khẩu** (sửa 17/11/2026): giữ phiên máy này, báo "Đã đổi mật khẩu nhưng chưa đăng xuất được các thiết bị khác." kèm nút "Thử lại" (3.2), thay cho "vẫn xoá phiên máy này". Web tự gọi Cognito `GlobalSignOut` vì Amplify 6.21.2 bắt lỗi bước này rồi vẫn xoá token (#477). Phần còn lại: access token đã cấp cho máy khác còn dùng được tới tối đa 1 giờ (threat model L10).
- Giới hạn đã biết: gọi thẳng Cognito bằng access token vẫn đổi được `preferred_username` và email (BR-06). Nhân ghi vào threat model.
- Bật xác thực hai lớp cho khách: làm ở #183 (18/11/2026, mục 3.4, 3.5, An chốt):
  - chỉ mã từ ứng dụng xác thực (TOTP), có hướng dẫn dùng ứng dụng trên máy tính cho khách không có điện thoại; không làm passkey;
  - icon `ShieldCheck` trên nút "Bật"; không thêm mục ở cột trái; ô mã không tự gửi; ô QR 176px, padding 12px (design-system §9.28);
  - thư viện `qrcode` 1.5.4 (ghim đúng bản), chỉ dùng `toDataURL`, nạp riêng ở trang bật; nhãn `otpauth` "Black Magic" + email, mã hoá URL;
  - mất thiết bị: xác minh qua email tài khoản và mã đơn, An tắt giúp (account.md BR-10);
  - admin chưa bật mà mở `/admin` thì chuyển sang trang bật (chỉ chặn ở web, admin-don-hang.md mục 1).

## 9. Việc còn lại

Đã làm xong (17/11/2026): `shared/auth` và đăng xuất dùng chung (#481); khung trang, cột mục, bảng chọn mục, mục menu "Tài khoản của tôi" (#485); đổi mật khẩu và quên mật khẩu khi đang đăng nhập (#496); đổi username, nút "Cập nhật", token `--fg-primary-disabled` (#497). Đang làm: xác thực hai lớp (#183, 3.1, 3.4, 3.5).

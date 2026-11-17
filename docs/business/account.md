# Tính năng: Tài khoản (đăng ký, đăng nhập, đăng xuất, quên mật khẩu, đổi username, đổi mật khẩu)

- Module: account (Cognito, `services/api/src/modules/account`, `apps/web/src/features/auth`)
- Vai trò: khách vãng lai, khách hàng, admin
- Người viết: An · Ngày: 08/10/2026 · Sửa: 11/11/2026 (quên mật khẩu, BR-13), 16/11/2026 (trang tài khoản: đổi username BR-06, đổi mật khẩu BR-14), 17/11/2026 (BR-14 đăng xuất mọi nơi, API đổi username #471)

Giao diện chi tiết ở [docs/web/pages/dang-nhap.md](../web/pages/dang-nhap.md) và [docs/web/pages/tai-khoan.md](../web/pages/tai-khoan.md). Quyết định kỹ thuật ở [ADR-0007](../adr/0007-http-api-jwt-cognito.md).

## User story

Là khách hàng, tôi muốn tạo tài khoản bằng email và đăng nhập nhanh để đặt hàng và xem lại đơn của mình, mà các món đã chọn khi chưa đăng nhập vẫn được giữ.

Là admin, tôi muốn đăng nhập cùng trang với khách nhưng được bảo vệ thêm bằng mã xác thực hai lớp, vì tài khoản admin sửa được sản phẩm và đơn hàng.

Là khách hàng quên mật khẩu, tôi muốn tự đặt mật khẩu mới bằng mã gửi về email, để không phải nhắn shop chờ người đặt lại giúp.

Là khách hàng đã đăng nhập, tôi muốn đổi username hiện trên header và đổi mật khẩu ngay trên web, để sửa tên đặt vội lúc đăng ký và đổi mật khẩu khi nghi bị lộ.

## Quy tắc nghiệp vụ

- BR-01: **Không cần tài khoản để xem hàng và thêm giỏ.** Khách vãng lai xem, tìm, thêm giỏ trên trình duyệt (cart.md BR-01). Bắt buộc đăng nhập khi: đặt hàng (ordering.md BR-01), xem đơn của mình, dùng giỏ trên server.
- BR-02: **Hai vai trò:** khách hàng (mặc định khi đăng ký, không thuộc nhóm nào) và admin (nhóm `admin` của Cognito, do An thêm bằng tay). Không có vai trò nhân viên (staff) trong MVP.
- BR-03: **Đăng ký** gồm username, email, mật khẩu, nhập lại mật khẩu. Khách tự đăng ký, không cần ai duyệt.
- BR-04: **Mật khẩu**: ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.
- BR-05: **Xác nhận email** bằng mã 6 số gửi tới email; mã hết hạn sau 24 giờ; gửi lại được. Chưa xác nhận thì chưa đăng nhập được: đăng nhập lúc này chuyển sang bước nhập mã và tự gửi mã mới.
- BR-06: **Username** chỉ để hiển thị trên header, không dùng để đăng nhập: 3–20 ký tự, chữ thường không dấu, số, dấu chấm, gạch dưới; không trùng người khác.
  - **Đổi được** ở trang tài khoản `/account` (sửa 16/11/2026): web gọi `PATCH /api/v1/me` với username mới; server kiểm cùng luật và không trùng như lúc đăng ký (Pre sign-up), rồi ghi `preferred_username` trên Cognito. Lỗi trả `application/problem+json` có `code`: `USERNAME_REQUIRED`, `USERNAME_INVALID` (400; gửi số hay mảng cũng là `USERNAME_INVALID`), `USERNAME_TAKEN` (409). Body không phải JSON thì 400 không có `code`.
  - Đổi sang đúng tên đang dùng thì 200 và không ghi gì. Kết quả trả `{ username }`, kèm `Cache-Control: no-store`.
  - Đổi xong thì header hiện tên mới (web làm mới phiên để ID token có tên mới). Tên cũ thành trống, người khác dùng được.
  - **Email không đổi được** (dùng để đăng nhập, BR-07).
  - **Giới hạn đã biết:** app client của Cognito vẫn ghi được `preferred_username` và `email` (đang để `mutable: true`), nên ai gọi thẳng Cognito bằng access token của mình thì đổi được hai trường này mà không qua kiểm trùng của server. Ghi trong threat model (Nhân).
- BR-07: **Đăng nhập bằng email và mật khẩu.** Sai email hoặc mật khẩu thì báo chung "Email hoặc mật khẩu không đúng.", không nói rõ sai cái nào (tránh dò email đã đăng ký).
- BR-08: **Phiên đăng nhập:** giữ đăng nhập 30 ngày trên cùng trình duyệt, tự làm mới mỗi giờ mà khách không thấy. Quá 30 ngày hoặc token bị thu hồi thì phải đăng nhập lại.
- BR-09: **Đăng xuất** trong menu tài khoản và ở trang tài khoản: kết thúc phiên trên trình duyệt này; giỏ khách trên trình duyệt bắt đầu lại từ rỗng; đang ở trang cần đăng nhập thì về trang chủ.
- BR-10: **Xác thực hai lớp (MFA):** khách hàng tuỳ chọn bật bằng ứng dụng xác thực (TOTP), không dùng SMS. Admin bắt buộc bật; bắt buộc này áp dụng khi có trang quản trị.
- BR-11: **Dữ liệu tài khoản chỉ gồm email và username.** Họ tên, số điện thoại, địa chỉ nhập ở trang đặt hàng cho từng đơn (ordering.md), không có sổ địa chỉ trong MVP.
- BR-12: **Thử sai nhiều lần:** Cognito tạm khoá lượt đăng nhập, đăng ký, gửi mã khi bị thử dồn dập; web báo "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại."
- BR-13: **Quên mật khẩu:** khách tự đặt lại, không cần đăng nhập. Bấm "Quên mật khẩu?" ở trang đăng nhập, nhập email; Cognito gửi mã 6 số tới email đó; khách nhập mã và mật khẩu mới (theo BR-04).
  - **Không cho biết email có tài khoản hay không:** email nào cũng sang bước nhập mã với câu "Nếu email này có tài khoản, mã đã được gửi", giống BR-07.
  - Gửi lại mã được. Thử dồn dập thì như BR-12.
  - Đặt lại xong thì về trang đăng nhập, email điền sẵn, đăng nhập như thường (tài khoản có MFA vẫn qua bước nhập mã như BR-10).
  - Đang đăng nhập mà mở quên mật khẩu (từ link "Quên mật khẩu hiện tại?" ở BR-14): ô email khoá theo email của tài khoản. Đặt lại xong thì web **đăng xuất máy này** rồi mới về trang đăng nhập, vì access token còn hạn tới 1 giờ và chưa đăng xuất thì `/login` đẩy về trang trước.
  - Đặt lại mật khẩu thì **các thiết bị khác đang đăng nhập bị đăng xuất** (thu hồi phiên cũ). Thiết bị đang mở có thể còn dùng thêm tối đa 1 giờ, tới khi phiên ngắn hạn hết hạn.
  - Thư dùng mẫu tiếng Anh mặc định của Cognito như thư mã đăng ký, chung hạn mức khoảng 50 thư/ngày của user pool.
- BR-14: **Đổi mật khẩu khi đã đăng nhập** (thêm 16/11/2026) ở `/account/password`: nhập mật khẩu hiện tại, mật khẩu mới (theo BR-04) và nhập lại.
  - Web gọi thẳng Cognito (Cognito ChangePassword qua `updatePassword` của Amplify, bằng access token của khách), không qua API của shop.
  - Sai mật khẩu hiện tại thì báo dưới ô đó "Mật khẩu hiện tại không đúng."; thử dồn dập thì báo như BR-12.
  - Đổi xong thì **đăng xuất mọi nơi, gồm cả máy đang dùng** (sửa 17/11/2026): web gọi `signOut({ global: true })` rồi về `/login` với câu "Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới.", email điền sẵn.
  - Lý do: khách thường đổi mật khẩu vì nghi bị lộ; giữ phiên cũ thì người lạ đã đăng nhập vẫn dùng tiếp được. Cách này khớp BR-13 (thu hồi phiên, L9) và không cần thêm Lambda. Thiết bị khác có thể còn dùng thêm tối đa 1 giờ, tới khi access token hết hạn.
  - Quên mật khẩu hiện tại thì đi luồng BR-13 (link "Quên mật khẩu hiện tại?" trên trang).

## Trường hợp đặc biệt

- Email đã có tài khoản → báo dưới ô email "Email này đã có tài khoản." kèm link đăng nhập.
- Username đã có người dùng → báo dưới ô username; không tạo tài khoản.
- Mã sai → "Mã không đúng. Kiểm tra lại email mới nhất."; mã quá 24 giờ → "Mã đã hết hạn. Bấm Gửi lại mã."
- Không nhận được email → nút "Gửi lại mã"; nhắc xem cả mục thư rác.
- Đã đăng nhập mà mở `/login` hoặc `/register` → về trang trước đó.
- Khách vãng lai bấm "Đặt hàng" rồi tạo tài khoản → xác nhận mã xong thì đăng nhập luôn, gộp giỏ và sang thẳng checkout (cart.md BR-10, BR-11).
- Đăng nhập ở hai tab → tab thứ hai dùng luôn phiên đang có.
- Quên mật khẩu → khách tự đặt lại theo BR-13. Shop không đặt lại mật khẩu giúp khách trên Cognito.
- Nhập email chưa có tài khoản ở bước quên mật khẩu → vẫn sang bước nhập mã như email có tài khoản, nhưng không có thư nào được gửi; nhập mã nào cũng không đặt được mật khẩu; câu báo lỗi chốt khi làm trang quên mật khẩu (#439).
- Tài khoản chưa xác nhận email mà bấm quên mật khẩu → chưa thử trên dev; câu báo lỗi chốt khi làm trang quên mật khẩu.
- Đổi username sang đúng tên đang dùng → web không gửi (nút "Cập nhật" chưa bấm được).
- Hai khách cùng lúc đổi sang một username còn trống → server kiểm rồi mới ghi, không khoá; hiếm gặp ở quy mô demo nên chấp nhận có thể trùng (như đăng ký).
- Phiên hết hạn khi đang đổi username hoặc mật khẩu → về trang đăng nhập, xong quay lại trang tài khoản.
- Xoá tài khoản → **ngoài MVP**; khách yêu cầu thì admin xoá trên Cognito.

## Tiêu chí nghiệm thu

- Given khách chưa có tài khoản, When đăng ký với username hợp lệ, email mới, mật khẩu đạt 5 điều kiện rồi nhập đúng mã, Then tài khoản ở trạng thái đã xác nhận, khách đã đăng nhập và header hiện username.
- Given username `an_nguyen` đã có người dùng, When một khách khác đăng ký với username đó, Then báo "Username này đã có người dùng." và không tạo tài khoản.
- Given tài khoản đã xác nhận, When đăng nhập sai mật khẩu, Then báo "Email hoặc mật khẩu không đúng."
- Given tài khoản chưa xác nhận email, When đăng nhập đúng mật khẩu, Then chuyển sang bước nhập mã và email nhận mã mới.
- Given khách đã đăng nhập, When gọi `GET /api/v1/me`, Then nhận 200 kèm `userId` và `groups`; chưa đăng nhập thì 401.
- Given tài khoản admin đã bật MFA, When đăng nhập đúng mật khẩu, Then phải nhập mã 6 số từ ứng dụng xác thực mới vào được.
- Given khách đã đăng nhập, When đăng xuất, Then header hiện nút "Đăng nhập" và `/orders` chuyển sang trang đăng nhập.
- Given tài khoản đã xác nhận, When khách bấm "Quên mật khẩu?", nhập email, nhập đúng mã và mật khẩu mới đạt 5 điều kiện, Then về trang đăng nhập với email điền sẵn, đăng nhập được bằng mật khẩu mới, còn mật khẩu cũ báo "Email hoặc mật khẩu không đúng."
- Given email chưa có tài khoản, When nhập ở bước quên mật khẩu, Then vẫn sang bước nhập mã với cùng câu chữ như email có tài khoản, và không có thư nào gửi đi.
- Given đang ở bước đặt mật khẩu mới, When nhập sai mã, Then báo "Mã không đúng. Kiểm tra lại email mới nhất." và mật khẩu chưa đổi.
- Given khách đang đăng nhập trên máy A, When đặt lại mật khẩu trên máy B, Then máy A bị đăng xuất chậm nhất sau 1 giờ (cần L9, PR infra của Nhân).
- Given khách `hoangnm` đã đăng nhập, When đổi username sang `hoang.nm` ở `/account`, Then `PATCH /api/v1/me` trả 200, header hiện `hoang.nm` mà không phải đăng nhập lại, và một khách khác đăng ký được với `hoangnm`.
- Given username `an_nguyen` đã có người dùng, When một khách khác đổi username sang `an_nguyen`, Then `PATCH /api/v1/me` trả 409 `USERNAME_TAKEN`, web báo "Username này đã có người dùng." và username không đổi.
- Given chưa đăng nhập, When gọi `PATCH /api/v1/me`, Then 401.
- Given khách đã đăng nhập, When đổi mật khẩu với mật khẩu hiện tại đúng và mật khẩu mới đạt 5 điều kiện, Then máy đang dùng bị đăng xuất và về `/login` với câu "Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới.", email điền sẵn; đăng nhập được bằng mật khẩu mới, còn mật khẩu cũ báo "Email hoặc mật khẩu không đúng."
- Given khách đang đăng nhập trên máy A, When đổi mật khẩu trên máy B, Then máy A bị đăng xuất chậm nhất sau 1 giờ.
- Given khách đã đăng nhập, When đổi mật khẩu với mật khẩu hiện tại sai, Then báo "Mật khẩu hiện tại không đúng." dưới ô mật khẩu hiện tại, mật khẩu không đổi và khách vẫn đăng nhập.
- Given khách đã đổi mật khẩu sai nhiều lần liền, When thử tiếp, Then báo "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại." (BR-12).
- Given khách đã đăng nhập, When gọi `PATCH /api/v1/me` với body không phải JSON, Then 400 không có `code`; với `username` là số hoặc mảng, Then 400 `USERNAME_INVALID`.

## Màn hình liên quan

- `/login`, `/register`, `/forgot-password`: [docs/web/pages/dang-nhap.md](../web/pages/dang-nhap.md)
- Nút và menu tài khoản trên header: design-system §9.17 (mục "Tài khoản của tôi")
- `/account`, `/account/password`: [docs/web/pages/tai-khoan.md](../web/pages/tai-khoan.md)

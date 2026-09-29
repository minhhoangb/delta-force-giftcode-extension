# Delta Force Giftcode — Extension

Extension Chrome/Edge đọc file TXT và thao tác trực tiếp trên tab đổi quà Delta Force Garena đang mở.

## Cài trên Chrome

1. Giải nén file ZIP.
2. Mở `chrome://extensions`.
3. Bật **Chế độ dành cho nhà phát triển**.
4. Chọn **Tải tiện ích đã giải nén**.
5. Chọn thư mục `DeltaForceGiftcodeExtension` vừa giải nén.

## Cài trên Microsoft Edge

1. Giải nén file ZIP.
2. Mở `edge://extensions`.
3. Bật **Chế độ nhà phát triển**.
4. Chọn **Tải phần mở rộng đã giải nén**.
5. Chọn thư mục `DeltaForceGiftcodeExtension`.

## Cách dùng

1. Bấm biểu tượng extension rồi chọn **Mở trang đổi code**.
2. Đăng nhập trên trang Delta Force Garena.
3. Trong bảng nổi bên phải, bấm **Chọn file TXT**. Mỗi dòng là một giftcode; dòng trống và dòng bắt đầu bằng `#` sẽ được bỏ qua.
4. Tự nhập thời gian chờ giữa các code và thời gian tối đa chờ thông báo.
5. Bấm **Bắt đầu**. Extension nhập code, bấm **Đổi**, đọc thông báo, bấm nút **X**, xóa code cũ rồi chờ trước khi xử lý code tiếp theo.
6. Có thể **Tạm dừng**, **Dừng**, tiếp tục từ code chưa xử lý hoặc **Xuất CSV**.

Nếu không thấy bảng điều khiển sau khi cài, hãy tải lại trang đổi quà một lần hoặc bấm biểu tượng extension → **Hiện / ẩn bảng điều khiển**.

## An toàn và dữ liệu

- Extension chỉ được cấp quyền trên `https://redeem.df.garena.sg/*`.
- Danh sách code và kết quả được lưu cục bộ trong bộ nhớ extension để có thể tiếp tục sau khi tải lại trang.
- Extension tự dừng nếu phát hiện thông báo **Truy cập tạm thời bị hạn chế**.
- Extension không che giấu tự động hóa và không vượt cơ chế chống bot. Việc trang chấp nhận thao tác vẫn phụ thuộc quy định và hệ thống bảo vệ của Garena.
- Để xóa kết quả, bấm **Làm mới danh sách**. Gỡ extension sẽ xóa toàn bộ dữ liệu cục bộ của extension.

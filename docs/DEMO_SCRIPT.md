# Kịch bản demo OpenSlot (8–10 phút)

## Chuẩn bị

Chạy API và frontend theo README. Mở ba cửa sổ ẩn danh hoặc ba profile trình duyệt để giữ đồng thời ba tài khoản:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Customer | `customer@openslot.local` | `Customer@12345` |
| Provider | `provider@openslot.local` | `Provider@12345` |
| Admin | `admin@openslot.local` | `Admin@12345` |

## Trình bày

### 1. Vấn đề và giá trị (1 phút)

“Nhiều doanh nghiệp dịch vụ mất doanh thu vì khung giờ trống sát giờ, trong khi khách hàng muốn một trải nghiệm linh hoạt với giá tốt. OpenSlot biến phần công suất sắp bị bỏ phí thành deal có giới hạn thời gian.”

Nhấn mạnh điểm khác website đặt lịch: đây là marketplace đa dịch vụ dành riêng cho công suất trống, provider chủ động giá và cửa sổ mở bán.

### 2. Customer discovery (2 phút)

- Mở trang chủ, lọc một danh mục và tìm theo từ khóa.
- Bấm định vị để sắp xếp theo khoảng cách; chuyển sang bản đồ OpenStreetMap.
- Mở chi tiết slot, chỉ giá gốc/giá deal, giờ đóng booking và số chỗ còn.
- Đăng nhập Customer và giữ chỗ; chỉ QR, public code và PIN.
- Mở “Lịch của tôi” và trung tâm thông báo.

### 3. Provider operations (2 phút)

- Đăng nhập Provider.
- Chỉ khu “Hồ sơ, địa điểm và dịch vụ”; tạo mới được trực tiếp từ UI.
- Tạo slot nháp với giá deal nhỏ hơn giá gốc, sau đó phát hành.
- Dùng public code và PIN của Customer để check-in, rồi bấm “Hoàn tất”.

Nếu slot demo chưa đến cửa sổ check-in, giải thích backend cố ý chặn check-in ngoài khoảng từ 15 phút trước đến 15 phút sau giờ bắt đầu.

### 4. Admin và moderation (1.5 phút)

- Đăng nhập Admin, chỉ dashboard số người dùng, slot, booking, tỷ lệ lấp đầy và no-show.
- Duyệt/khóa provider.
- Khóa/mở tài khoản người dùng.
- Từ Customer gửi báo cáo một slot, quay lại Admin xử lý báo cáo.

### 5. Kỹ thuật nổi bật (1.5 phút)

- JWT + role authorization, Identity password hashing.
- EF Core migration và SQLite cho bản demo gọn nhẹ.
- Transaction + optimistic concurrency chống overbooking.
- Background worker tự hết hạn slot/no-show và cơ chế 3 strike trong 30 ngày.
- OpenStreetMap không cần billing; Dockerfile deploy cả hệ thống bằng một URL.

## Câu kết

“MVP đã chạy trọn ba luồng Customer–Provider–Admin. Bước phát triển tiếp theo là thanh toán/hoàn tiền, đánh giá hai chiều, đồng bộ lịch provider và chuyển SQLite sang PostgreSQL khi có tải thật.”

# Báo cáo kiểm thử OpenSlot

Ngày kiểm thử gần nhất: 10/09/2026.

## Kiểm thử tự động

| Hạng mục | Kết quả |
| --- | --- |
| `dotnet test OpenSlot.slnx --no-restore` | 12 passed, 0 failed |
| `npm run lint` | Thành công, 0 warning/error |
| `npm run build` | Thành công, TypeScript và Vite production build |

Unit test tập trung vào `SlotPolicy` và chuẩn hóa slug danh mục: giá hợp lệ, giá deal thấp hơn giá gốc, thời gian bắt đầu/kết thúc, cửa sổ booking, capacity, điều kiện phát hành và tên danh mục tiếng Việt.

## Smoke test API

- Health endpoint trả `ok`.
- Tài khoản seed đăng nhập đúng bốn role; Provider được seed thành sáu tài khoản độc lập.
- Database sạch có 6 category, 6 provider profile, 6 venue, 12 service, 12 đơn vị đặt và 12 deal slot demo.
- API provider catalog không còn trả `defaultDurationMinutes`; thời lượng được lưu ở `startAtUtc`/`endAtUtc` của slot.
- Customer browse/search, tạo booking, nhận notification và gửi report.
- Provider đọc profile/catalog, tạo/phát hành slot và quản lý check-in.
- Customer gửi hồ sơ cửa hàng, hệ thống bổ sung Provider Pending nhưng vẫn giữ Customer; Manager tìm thấy hồ sơ, xem chi tiết, duyệt thành công và Provider có thể phát hành slot.
- Manager/Admin đọc dashboard/provider/user/service/slot/report, quản lý danh mục, ẩn–mở dịch vụ, hủy slot trống và xử lý report.
- Khi admin ẩn một dịch vụ, số slot public giảm từ 3 xuống 2; khi mở lại trở về 3.
- Token cũ của tài khoản vừa bị khóa trả `401 Unauthorized` ngay ở request kế tiếp.

## Kiểm thử concurrency

Thiết lập một slot capacity = 1, dùng hai tài khoản Customer gửi request booking gần như đồng thời:

| Request | HTTP status |
| --- | --- |
| Customer A | `409 Conflict` |
| Customer B | `201 Created` |

Kết quả: chỉ 1 booking được ghi nhận, không overbooking.

## Checklist trước demo

- [ ] API và frontend mở được trên máy trình bày.
- [ ] Trang chủ có 12 slot tương lai từ 6 nhóm dịch vụ.
- [ ] Đăng nhập được Customer, Provider, Manager và Admin.
- [ ] Trình duyệt được cấp quyền vị trí nếu demo khoảng cách.
- [ ] Có Internet nếu muốn tải tile OpenStreetMap; phần còn lại vẫn chạy local.
- [ ] Không chiếu `Jwt__Key` hoặc secret triển khai.

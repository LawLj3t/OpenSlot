# Báo cáo kiểm thử OpenSlot

Ngày kiểm thử gần nhất: 09/09/2026.

## Kiểm thử tự động

| Hạng mục | Kết quả |
| --- | --- |
| `dotnet test OpenSlot.slnx --no-restore` | 8 passed, 0 failed |
| `npm run lint` | Thành công, 0 warning/error |
| `npm run build` | Thành công, TypeScript và Vite production build |

Unit test tập trung vào `SlotPolicy`: giá hợp lệ, giá deal thấp hơn giá gốc, thời gian bắt đầu/kết thúc, cửa sổ booking, capacity và điều kiện phát hành.

## Smoke test API

- Health endpoint trả `ok`.
- Ba tài khoản seed đăng nhập đúng ba role.
- Database sạch có 3 user, 3 venue, 3 service và 3 deal slot demo.
- Customer browse/search, tạo booking, nhận notification và gửi report.
- Provider đọc profile/catalog, tạo/phát hành slot và quản lý check-in.
- Admin đọc dashboard/provider/user/service/slot/report, ẩn–mở dịch vụ, hủy slot trống và xử lý report.
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
- [ ] Trang chủ có 3 slot tương lai.
- [ ] Đăng nhập được cả ba tài khoản.
- [ ] Trình duyệt được cấp quyền vị trí nếu demo khoảng cách.
- [ ] Có Internet nếu muốn tải tile OpenStreetMap; phần còn lại vẫn chạy local.
- [ ] Không chiếu `Jwt__Key` hoặc secret triển khai.

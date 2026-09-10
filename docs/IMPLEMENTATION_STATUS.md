# Đối chiếu phạm vi triển khai

## Đã hoàn thành

| Giai đoạn | Nội dung đã có |
| --- | --- |
| Domain/database | entity nghiệp vụ, quan hệ/index, migration và seed data 6 nhóm/6 Provider/12 dịch vụ |
| Authentication | đăng ký, đăng nhập, Identity password hash, JWT, 4 role, khóa phiên tức thời |
| Provider | tự nộp hồ sơ cửa hàng, venue, đơn vị đặt, service, tạo/sửa/phát hành/hủy slot, chống trùng giờ; chỉ hồ sơ đã duyệt mới được phát hành |
| Customer | browse/search/filter/geolocation/map, chi tiết, booking, lịch sử, hủy |
| Anti-abuse | cửa sổ đặt chỗ, giới hạn 3 deal/ngày, rate limit, strike và khóa 7 ngày |
| Check-in | QR/public code, PIN đã hash, giới hạn thời gian, complete/no-show |
| Manager/Admin | dashboard, duyệt/yêu cầu bổ sung/tạm khóa Provider, quản lý danh mục, user, service, slot và report moderation; Admin quản lý quyền Manager |
| UX | responsive, loading/empty/error state, notification center và trang 404 |
| QA | 9 unit test, API smoke test, catalog seed smoke test, production bundle smoke test |
| Delivery | README, architecture, demo script, test report, Dockerfile |

## Cố ý để ngoài MVP

- Thanh toán và hoàn tiền thật.
- Email/SMS/push notification ngoài ứng dụng.
- Đánh giá hai chiều và chat.
- Đồng bộ lịch của provider.
- Native mobile app.
- Hạ tầng production có PostgreSQL, backup và monitoring.

Các mục này không phải phần còn dang dở của bản một tháng; chúng là hướng phát triển khi sản phẩm có người dùng thật.

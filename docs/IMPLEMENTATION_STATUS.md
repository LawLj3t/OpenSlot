# Đối chiếu phạm vi triển khai

## Đã hoàn thành

| Giai đoạn | Nội dung đã có |
| --- | --- |
| Domain/database | 9 entity nghiệp vụ, quan hệ/index, migration và seed data |
| Authentication | đăng ký, đăng nhập, Identity password hash, JWT, 3 role, khóa phiên tức thời |
| Provider | hồ sơ, venue, service, tạo/sửa/phát hành/hủy slot, chống trùng giờ |
| Customer | browse/search/filter/geolocation/map, chi tiết, booking, lịch sử, hủy |
| Anti-abuse | cửa sổ đặt chỗ, giới hạn 3 deal/ngày, rate limit, strike và khóa 7 ngày |
| Check-in | QR/public code, PIN đã hash, giới hạn thời gian, complete/no-show |
| Admin | dashboard, provider, user, service, slot và report moderation |
| UX | responsive, loading/empty/error state, notification center và trang 404 |
| QA | 8 unit test, API smoke test, concurrency test, production bundle smoke test |
| Delivery | README, architecture, demo script, test report, Dockerfile |

## Cố ý để ngoài MVP

- Thanh toán và hoàn tiền thật.
- Email/SMS/push notification ngoài ứng dụng.
- Đánh giá hai chiều và chat.
- Đồng bộ lịch của provider.
- Native mobile app.
- Hạ tầng production có PostgreSQL, backup và monitoring.

Các mục này không phải phần còn dang dở của bản một tháng; chúng là hướng phát triển khi sản phẩm có người dùng thật.

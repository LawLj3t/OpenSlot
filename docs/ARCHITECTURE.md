# Kiến trúc OpenSlot

## Tổng quan

OpenSlot là modular monolith gồm React SPA, ASP.NET Core Web API và SQLite. Frontend chỉ giao tiếp với API qua JSON; khi deploy, ASP.NET Core phục vụ luôn các file React đã build để có một URL duy nhất.

```text
Browser (React + Leaflet)
        |
        | HTTPS / JSON / JWT
        v
ASP.NET Core API
  |-- Auth & role authorization
  |-- Customer discovery/booking
  |-- Provider catalog/slots/check-in
  |-- Admin/moderation
  |-- Background lifecycle worker
        |
        v
SQLite + EF Core migrations
```

## Mô hình dữ liệu

- `ApplicationUser`: tài khoản, strike và trạng thái khóa.
- `ProviderProfile`: hồ sơ đối tác gắn 1-1 với user.
- `Venue`: địa điểm và tọa độ bản đồ.
- `Category`, `ServiceOffering`: danh mục và dịch vụ tại một venue.
- `DealSlot`: khung giờ, giá, sức chứa, cửa sổ booking và concurrency token.
- `Booking`: khách, trạng thái, public code và PIN đã hash.
- `Notification`, `Report`, `AuditLog`: thông báo, kiểm duyệt và dấu vết vận hành.

## Luồng chính

1. Admin duyệt provider.
2. Provider tạo venue, service và slot nháp; hệ thống kiểm tra giờ, giá, sức chứa và slot chồng lấn.
3. Provider phát hành slot.
4. Customer tìm theo từ khóa/khu vực/danh mục hoặc vị trí hiện tại, rồi đặt chỗ.
5. Transaction và concurrency token bảo đảm không bán vượt sức chứa.
6. Hệ thống trả QR/PIN; provider check-in trong cửa sổ hợp lệ và đánh dấu hoàn tất.
7. Worker tự hết hạn slot, đánh dấu no-show và áp dụng strike.

## Bảo mật và tính toàn vẹn

- ASP.NET Core Identity hash mật khẩu; API dùng JWT và role `Customer`, `Provider`, `Admin`.
- PIN check-in 6 số sinh bằng bộ tạo số ngẫu nhiên mật mã và chỉ lưu bản hash.
- Mọi provider query đều kiểm tra quyền sở hữu dữ liệu.
- Request booking được rate-limit; validation chạy ở cả client và server.
- Unique index ngăn một khách đặt cùng slot hai lần.
- EF transaction cùng optimistic concurrency bảo vệ chiếc chỗ cuối cùng.
- Admin action và thay đổi vòng đời quan trọng được lưu audit log.

## Quyết định phạm vi

Không có thanh toán thật, SMS/email, native mobile hay đồng bộ lịch bên thứ ba trong MVP. Bản đồ dùng OpenStreetMap/Leaflet và trình duyệt geolocation, không cần API key hoặc tài khoản thanh toán Google Cloud.

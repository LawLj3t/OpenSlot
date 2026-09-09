# OpenSlot

Nền tảng săn các khung giờ dịch vụ còn trống với ưu đãi sát giờ. Đồ án cá nhân được xây dựng cho kỳ thực tập tại VNPT.

## Chức năng chính

- Khách hàng: đăng ký, đăng nhập, khám phá/lọc slot, giữ chỗ, QR/PIN check-in, xem và hủy lịch.
- Đối tác: cập nhật hồ sơ, tạo địa điểm/dịch vụ, tạo và phát hành slot, check-in rồi hoàn tất dịch vụ.
- Quản trị viên: dashboard vận hành, duyệt/tạm khóa đối tác, khóa/mở người dùng và xử lý báo cáo.
- Hệ thống: thông báo trong app, tìm kiếm theo từ khóa/khu vực, bản đồ thật và sắp xếp theo khoảng cách hiện tại.
- Quy tắc chống lạm dụng: đóng booking trước giờ bắt đầu 15 phút; một khách tối đa 3 booking deal còn hiệu lực/ngày; hủy sát giờ/no-show nhận strike; sau 3 strike trong 30 ngày bị khóa đặt chỗ 7 ngày; chống overbooking bằng optimistic concurrency.

## Công nghệ

- Backend: C# / ASP.NET Core 10 Web API, EF Core, Identity, JWT, SQLite, Swagger.
- Frontend: React 19, TypeScript, Vite, Bootstrap 5, React Router, QR code.
- Maps: OpenStreetMap + Leaflet (marker thật theo tọa độ, miễn phí, không cần API key).
- Tests: xUnit.

## Chạy tại máy local

Yêu cầu: .NET SDK 10 và Node.js 24+.

```powershell
cd backend/OpenSlot.Api
dotnet restore
dotnet run --urls http://127.0.0.1:5080
```

Mở terminal khác:

```powershell
cd frontend/openslot-web
npm install
npm run dev
```

Truy cập frontend tại `http://127.0.0.1:5173`, Swagger tại `http://127.0.0.1:5080/swagger`.

## Tài khoản demo

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Customer | `customer@openslot.local` | `Customer@12345` |
| Provider | `provider@openslot.local` | `Provider@12345` |
| Admin | `admin@openslot.local` | `Admin@12345` |

Các tài khoản này chỉ được tạo khi môi trường là Development hoặc `SeedDemoData=true`. Không bật seed demo cho sản phẩm thật.

## Bản đồ

OpenSlot dùng OpenStreetMap qua Leaflet. Không cần Google Cloud, billing account hoặc API key. Bấm “Xem trên bản đồ” ở trang chủ để xem marker thật của các đối tác demo.

## Kiểm thử

```powershell
dotnet test OpenSlot.slnx --no-restore
cd frontend/openslot-web
npm run lint
npm run build
```

Kết quả QA hiện tại: backend 8/8 unit test đạt, frontend build và lint sạch. Luồng tranh chỗ cuối đã được kiểm thử đồng thời: đúng một request nhận `201`, request còn lại nhận `409`.

## Chạy bằng Docker

Dockerfile ở thư mục gốc build React và phục vụ cả frontend lẫn API trên một URL:

```powershell
docker build -t openslot .
docker run --rm -p 8080:8080 `
  -e Jwt__Key="thay-bang-chuoi-ngau-nhien-it-nhat-32-byte" `
  -e SeedDemoData=true `
  -e "ConnectionStrings__OpenSlotDb=Data Source=/data/openslot.db" `
  -v openslot-data:/data `
  openslot
```

Truy cập `http://localhost:8080`.

## Deploy miễn phí lên Render

Repository có sẵn `render.yaml` để tạo một Web Service Docker gói Free. Trên Render, chọn **New > Blueprint**, kết nối repository này rồi deploy. Render tự sinh `Jwt__Key`, chạy health check tại `/health` và cung cấp một URL `onrender.com`.

Bản review miễn phí dùng SQLite tại `/tmp/openslot.db`. Dữ liệu phát sinh có thể bị xóa khi instance khởi động lại, nhưng `SeedDemoData=true` sẽ tự tạo lại tài khoản và dữ liệu mẫu. Cấu hình này chỉ dành cho mentor/giám khảo trải nghiệm, không dành cho production thật.

## Lưu ý trước khi deploy

- Khi deploy, đặt ít nhất `Jwt__Key` (chuỗi ngẫu nhiên tối thiểu 32 bytes) và `ConnectionStrings__OpenSlotDb` qua biến môi trường hoặc secret manager. Key development chỉ nằm trong `appsettings.Development.json`.
- Tắt seed tài khoản demo khi triển khai sản phẩm thật.
- SQLite phù hợp demo/mentor review. Khi có nhiều người dùng, chuyển sang SQL Server hoặc PostgreSQL.

## Tài liệu bàn giao

- [Kiến trúc và nghiệp vụ](docs/ARCHITECTURE.md)
- [Kịch bản demo cho mentor](docs/DEMO_SCRIPT.md)
- [Báo cáo kiểm thử](docs/TEST_REPORT.md)
- [Đối chiếu phạm vi đã hoàn thành](docs/IMPLEMENTATION_STATUS.md)
- [Hướng dẫn triển khai](docs/DEPLOYMENT.md)

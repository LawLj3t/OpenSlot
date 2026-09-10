# OpenSlot

Nền tảng săn các khung giờ dịch vụ còn trống với ưu đãi sát giờ. Đồ án cá nhân được xây dựng cho kỳ thực tập tại VNPT.

**Demo trực tiếp:** [openslot-vn.onrender.com](https://openslot-vn.onrender.com)

## Chức năng chính

- Khách hàng: đăng ký, đăng nhập, khám phá/lọc slot, giữ chỗ, QR/PIN check-in, xem và hủy lịch.
- Đối tác: chủ cửa hàng tự nộp hồ sơ, cập nhật địa điểm, khai báo sân/bàn/ghế/phòng có thể đặt, tạo dịch vụ và phát hành slot đúng đơn vị; check-in rồi hoàn tất dịch vụ.
- Đối tác: một tài khoản vẫn giữ quyền Khách hàng để đặt dịch vụ; người dùng chọn cổng Khách hàng hoặc Đối tác khi đăng nhập và có thể chuyển lại trong thanh điều hướng.
- Manager: dashboard vận hành, duyệt/yêu cầu bổ sung/tạm khóa đối tác, xem chi tiết cửa hàng/địa điểm/đơn vị đặt/dịch vụ/slot, quản lý danh mục chung, theo dõi tài khoản, kiểm duyệt dịch vụ/slot và xử lý báo cáo.
- Quản trị viên: quản lý toàn hệ thống và cấp/thu hồi quyền Manager.
- Hệ thống: thông báo trong app, tìm kiếm theo từ khóa/khu vực, bản đồ thật và sắp xếp theo khoảng cách hiện tại.
- Dữ liệu demo: 6 nhóm dịch vụ, 6 đối tác, 6 địa điểm, 12 đơn vị có thể đặt và 12 slot sát giờ tại Hà Nội.
- Quy tắc chống lạm dụng: đóng booking trước giờ bắt đầu 15 phút; một khách tối đa 3 booking deal còn hiệu lực/ngày; hủy sát giờ/no-show nhận strike; sau 3 strike trong 30 ngày bị khóa đặt chỗ 7 ngày; không cho hai slot trùng giờ trên cùng sân/bàn/ghế/phòng; chống overbooking bằng optimistic concurrency.

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
| Provider – Campus Active | `provider@openslot.local` | `Provider@12345` |
| Provider – Glow Wellness | `beauty@openslot.local` | `Beauty@12345` |
| Provider – Focus Hub | `workspace@openslot.local` | `Workspace@12345` |
| Provider – Frame Lab | `creative@openslot.local` | `Creative@12345` |
| Provider – Play Loft | `entertainment@openslot.local` | `Entertainment@12345` |
| Provider – Care Express | `utility@openslot.local` | `Utility@12345` |
| Manager | `manager@openslot.local` | `Manager@12345` |
| Admin | `admin@openslot.local` | `Admin@12345` |

Các tài khoản này chỉ được tạo khi môi trường là Development hoặc `SeedDemoData=true`. Không bật seed demo cho sản phẩm thật.

## Catalog demo

Sáu nhóm dịch vụ gồm Thể thao, Làm đẹp, Không gian làm việc, Sáng tạo, Giải trí và Tiện ích. Dữ liệu demo có sáu Provider độc lập, đại diện cho sáu cửa hàng/địa điểm khác nhau. Đây chỉ là dữ liệu mẫu: kiến trúc không giới hạn một Provider vào một nhóm dịch vụ; Provider tự tạo dịch vụ của cửa hàng và chọn danh mục do Manager quản lý.

Tên dịch vụ không gắn số phút. Provider khai báo **giờ bắt đầu và giờ kết thúc cho từng slot thực tế**, nên cùng một dịch vụ có thể có các khung trống khác nhau.

## Quy trình đối tác

1. Customer đăng ký tài khoản rồi gửi hồ sơ cửa hàng để được **bổ sung** quyền Provider; cùng email đó vẫn đặt dịch vụ như Customer.
2. Tài khoản Provider ở trạng thái **Chờ duyệt** có thể chuẩn bị hồ sơ, địa điểm, dịch vụ, đơn vị đặt và slot nháp.
3. Manager duyệt, yêu cầu bổ sung hoặc tạm khóa hồ sơ. Chỉ Provider đã duyệt mới phát hành slot công khai.
4. Manager quản lý danh mục chung; Provider tự khai báo dịch vụ cụ thể của cửa hàng.

## Bản đồ

OpenSlot dùng OpenStreetMap qua Leaflet. Không cần Google Cloud, billing account hoặc API key. Bấm “Xem trên bản đồ” ở trang chủ để xem marker thật của các đối tác demo.

## Kiểm thử

```powershell
dotnet test OpenSlot.slnx --no-restore
cd frontend/openslot-web
npm run lint
npm run build
```

Kết quả QA hiện tại: backend 9/9 unit test đạt, frontend build và lint sạch. Luồng tranh chỗ cuối đã được kiểm thử đồng thời: đúng một request nhận `201`, request còn lại nhận `409`.

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

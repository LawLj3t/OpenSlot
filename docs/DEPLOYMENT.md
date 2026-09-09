# Triển khai OpenSlot

## Mô hình đề xuất cho bản review

Deploy Dockerfile ở thư mục gốc lên một container host. React được build vào `wwwroot` của API, vì vậy frontend và backend dùng chung domain, không phải cấu hình CORS production.

## Biến môi trường bắt buộc

| Tên | Giá trị mẫu | Ghi chú |
| --- | --- | --- |
| `Jwt__Key` | chuỗi ngẫu nhiên dài từ 32 byte | Lưu dưới dạng secret |
| `ConnectionStrings__OpenSlotDb` | `Data Source=/data/openslot.db` | `/data` nên là persistent volume |
| `SeedDemoData` | `true` | Chỉ dùng bản mentor review |
| `ASPNETCORE_URLS` | `http://+:8080` | Dockerfile đã đặt sẵn |

## Build và chạy local bằng Docker

```powershell
docker build -t openslot .
docker run --rm -p 8080:8080 `
  -e Jwt__Key="thay-bang-chuoi-ngau-nhien-it-nhat-32-byte" `
  -e SeedDemoData=true `
  -e "ConnectionStrings__OpenSlotDb=Data Source=/data/openslot.db" `
  -v openslot-data:/data `
  openslot
```

Kiểm tra `http://localhost:8080/health`, sau đó mở `http://localhost:8080`.

## Các bước trên dịch vụ hosting

1. Tạo web service/container từ repository Git.
2. Chọn Dockerfile ở thư mục gốc và port `8080`.
3. Tạo persistent disk/volume mount tại `/data` nếu nền tảng hỗ trợ.
4. Khai báo các biến môi trường ở trên, đặc biệt `Jwt__Key` dưới dạng secret.
5. Deploy và kiểm tra `/health` trước khi gửi URL cho mentor.

Nếu host miễn phí không có persistent volume, app vẫn chạy nhưng dữ liệu phát sinh có thể mất khi container restart; seed demo sẽ tạo lại dữ liệu mẫu. Đây là hạn chế chấp nhận được cho buổi review, không phù hợp sản phẩm thật.

## Render Free (cấu hình sẵn)

File `render.yaml` ở thư mục gốc khai báo một Docker Web Service miễn phí:

- Build toàn bộ frontend và backend bằng `Dockerfile`.
- Lắng nghe tại port `10000`, health check ở `/health`.
- Tự sinh `Jwt__Key`, không lưu secret trong Git.
- Bật dữ liệu demo và đặt SQLite tại `/tmp/openslot.db`.

Trên Render Dashboard, chọn **New > Blueprint**, kết nối repository, chọn file `render.yaml` và xác nhận deploy. Gói Free có thể ngủ khi không có truy cập; lần mở đầu tiên sau khi ngủ sẽ chậm hơn. Vì filesystem miễn phí không bền vững, dữ liệu mới có thể reset nhưng dữ liệu mẫu sẽ tự khôi phục.

## Production thật

- Đặt `SeedDemoData=false`.
- Dùng PostgreSQL hoặc SQL Server managed thay SQLite.
- Terminate HTTPS ở reverse proxy của nền tảng.
- Cấu hình backup, log tập trung, health monitoring và secret rotation.
- Thay tile server công cộng hoặc tuân thủ chính sách usage của OpenStreetMap khi traffic tăng.

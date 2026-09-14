# Triển khai OpenSlot

## Mô hình đề xuất cho bản review

Deploy Dockerfile ở thư mục gốc lên một container host. React được build vào `wwwroot` của API, vì vậy frontend và backend dùng chung domain, không phải cấu hình CORS production.

## Biến môi trường bắt buộc

| Tên | Giá trị mẫu | Ghi chú |
| --- | --- | --- |
| `Jwt__Key` | chuỗi ngẫu nhiên dài từ 32 byte | Lưu dưới dạng secret |
| `ConnectionStrings__OpenSlotDb` | Chuỗi kết nối PostgreSQL | Bắt buộc dùng database persistent khi chạy công khai |
| `SeedDemoData` | `true` | Chỉ dùng bản mentor review |
| `ASPNETCORE_URLS` | `http://+:8080` | Dockerfile đã đặt sẵn |
| `Email__GoogleClientId` | `...apps.googleusercontent.com` | OAuth client ID của Google Cloud |
| `Email__GoogleClientSecret` | `GOCSPX-...` | OAuth client secret, lưu dạng secret |
| `Email__GoogleRefreshToken` | `1//...` | Refresh token Gmail API, lưu dạng secret |
| `Email__GoogleSenderEmail` | `lam1292003@gmail.com` | Gmail dùng để gửi link xác minh |
| `Email__FromName` | `OpenSlot` | Tên hiển thị trong email |
| `Email__PublicBaseUrl` | `https://openslot-vn.onrender.com` | Domain công khai để tạo link xác minh |

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
3. Tạo một PostgreSQL database persistent (ví dụ Neon, Supabase hoặc Render PostgreSQL) rồi đặt toàn bộ connection string vào `ConnectionStrings__OpenSlotDb`.
4. Không dùng `Data Source=/tmp/openslot.db` trên Render: mỗi deploy sẽ xóa toàn bộ tài khoản, slot và booking.

## Database trên môi trường công khai

OpenSlot tự nhận diện chuỗi kết nối PostgreSQL bắt đầu bằng `Host=` hoặc `postgresql://`. Với PostgreSQL mới, ứng dụng tạo schema khi chạy lần đầu và seed dữ liệu demo khi `SeedDemoData=true`. Sau đó mọi thay đổi do người dùng tạo được lưu trong database cloud, độc lập với mỗi lần Render deploy.

SQLite vẫn được giữ cho môi trường phát triển local. Không dùng SQLite trong thư mục tạm trên Render.
4. Khai báo các biến môi trường ở trên, đặc biệt `Jwt__Key` dưới dạng secret.
5. Deploy và kiểm tra `/health` trước khi gửi URL cho mentor.

Nếu host miễn phí không có persistent volume, app vẫn chạy nhưng dữ liệu phát sinh có thể mất khi container restart; seed demo sẽ tạo lại dữ liệu mẫu. Đây là hạn chế chấp nhận được cho buổi review, không phù hợp sản phẩm thật.

## Xác minh Gmail bằng link (demo miễn phí)

OpenSlot dùng Gmail API qua HTTPS để gửi link xác minh khi người dùng đăng ký Gmail. Không dùng SMS hoặc OTP. Trong Google Cloud Console, tạo OAuth client cho ứng dụng web, bật Gmail API và cấp scope `https://www.googleapis.com/auth/gmail.send` cho Gmail gửi thư. Lưu client secret và refresh token ở Render qua các biến `Email__...` trong bảng trên; tuyệt đối không đặt các giá trị này trong `appsettings.json` hoặc commit vào Git.

Người đăng ký có thể dùng bất kỳ Gmail nào; Gmail gửi thư chỉ là địa chỉ "From" đã được cấp quyền OAuth. Render Free chặn SMTP nhưng không chặn Gmail API qua HTTPS. Nếu chưa cấu hình API, đăng ký mới sẽ trả thông báo dịch vụ email đang được thiết lập; tài khoản demo `@openslot.local` vẫn đăng nhập bình thường. Sau khi cấu hình, hãy đăng ký một Gmail thử nghiệm, mở link email và đăng nhập để kiểm tra toàn bộ luồng.

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

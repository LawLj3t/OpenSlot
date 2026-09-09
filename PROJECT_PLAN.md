# OpenSlot – Project Plan

## 1. Mục tiêu sản phẩm

OpenSlot là web app kết nối người dùng với các khung giờ dịch vụ còn trống được nhà cung cấp mở bán trong thời gian ngắn với giá ưu đãi. Đây là marketplace cho slot sát giờ, không phải website đặt lịch thông thường.

MVP chỉ seed và demo ba nhóm ít rủi ro: sân thể thao, salon/spa và không gian học tập/coworking. Kiến trúc dữ liệu vẫn cho phép thêm workshop hoặc nhóm dịch vụ khác sau này. Không hỗ trợ y tế, vận tải và các dịch vụ có quy định đặc thù.

## 2. Phạm vi MVP trong một tháng

- Ba vai trò: Customer, Provider, Admin.
- Provider tạo và phát hành slot với giá gốc, giá deal, số lượng, thời gian mở bán và thời hạn check-in.
- Customer tìm kiếm/lọc slot và đặt chỗ.
- Hệ thống tạo mã PIN/QR cho booking.
- Provider xác nhận check-in và hoàn tất booking.
- Tự động khóa slot khi đủ chỗ hoặc hết hạn.
- Giới hạn đặt chỗ, hủy chỗ và ghi nhận no-show để chống lạm dụng.
- Admin quản lý tài khoản, nhà cung cấp, dịch vụ, slot và báo cáo vi phạm.
- Không tích hợp thanh toán thật trong MVP; dùng trạng thái thanh toán mô phỏng.

### 2.1. Quy tắc nghiệp vụ đã chốt

- Múi giờ toàn hệ thống là `Asia/Ho_Chi_Minh`; mọi mốc thời gian được lưu UTC và hiển thị theo giờ Việt Nam.
- Provider chỉ được phát hành slot sau khi đã được Admin duyệt.
- Provider chủ động nhập giá gốc, giá deal, thời điểm mở/đóng đặt chỗ, số lượng và thời hạn check-in. Giá deal phải nhỏ hơn giá gốc; hệ thống không tự động giảm giá vô hạn.
- Slot chỉ cho phép đặt trong cửa sổ `BookingOpensAt` đến `BookingClosesAt`; đóng đặt chỗ tối thiểu 15 phút trước giờ bắt đầu.
- Mỗi Customer tối đa 3 booking deal đang hoạt động trong một ngày và không thể đặt trùng một slot.
- Hủy trong vòng 2 giờ trước giờ bắt đầu hoặc không check-in được ghi một strike. Ba strike trong 30 ngày sẽ khóa quyền đặt deal trong 7 ngày.
- Hệ thống tạo PIN một lần và QR chứa mã booking sau khi reservation được xác nhận. Check-in chỉ hợp lệ từ 15 phút trước đến 15 phút sau giờ bắt đầu.
- Khi hai người đặt chiếc chỗ cuối cùng cùng lúc, chỉ một booking được xác nhận bằng transaction/concurrency control ở backend.
- Slot và booking hết hạn được xử lý bởi background worker; Provider không được giảm số lượng hoặc đổi giá của slot đã có booking xác nhận.

### 2.2. Ngoài phạm vi MVP

- Thanh toán thực, hoàn tiền và hóa đơn điện tử.
- SMS, email, push notification và tích hợp lịch của bên thứ ba.
- Chỉ đường, geocoding và Places Autocomplete. MVP dùng OpenStreetMap/Leaflet để hiển thị tọa độ thật và browser geolocation để sắp xếp theo khoảng cách.
- Đồng bộ lịch trực tiếp từ phần mềm vận hành của Provider.
- Ứng dụng mobile native.

## 3. Công nghệ và môi trường

- Hệ điều hành: Windows.
- IDE: Visual Studio Code 1.134 hoặc Visual Studio nếu cần.
- Backend: ASP.NET Core Web API trên .NET 10.
- Database: SQLite với Entity Framework Core.
- Authentication: ASP.NET Core Identity + JWT.
- Frontend: React + TypeScript + Vite.
- UI: Bootstrap 5, responsive cho desktop và mobile.
- Bản đồ: OpenStreetMap + Leaflet, marker tọa độ thật và browser geolocation; không cần API key/billing.
- Tính khoảng cách: công thức Haversine ở backend; không cần API chỉ đường.
- API documentation: Swagger/OpenAPI.
- Test: xUnit cho backend và smoke test thủ công trên trình duyệt.
- Version control: Git.

## 4. Cấu trúc project dự kiến

```text
OpenSlot/
├── backend/
│   ├── OpenSlot.Api/
│   └── OpenSlot.Tests/
├── frontend/
│   └── openslot-web/
├── docs/
├── seed/
└── PROJECT_PLAN.md
```

Backend dùng mô hình modular monolith: một API deployable nhưng tách rõ Domain, Data, Services, Controllers, Authentication và Jobs để phù hợp thời hạn một tháng, tránh over-engineering microservices.

## 5. Các giai đoạn thực hiện

### Giai đoạn 0 – Chốt nghiệp vụ

- Chốt thuật ngữ: Provider, Venue, ServiceOffering, DealSlot, Booking, Check-in.
- Chốt trạng thái và quy tắc chống lạm dụng.
- Viết user stories và acceptance criteria.
- Tạo dữ liệu demo cho một khu vực giới hạn và ba danh mục dịch vụ.

### Giai đoạn 1 – Khởi tạo solution

- Tạo solution .NET và React app.
- Cấu hình SQLite, EF Core, Swagger, CORS và biến môi trường.
- Tạo Git repository và README khởi đầu.
- Kiểm tra backend/frontend chạy độc lập.

### Giai đoạn 2 – Domain và database

- Tạo entity ApplicationUser, ProviderProfile, Venue, Category, ServiceOffering, DealSlot, Booking, Report, Notification và AuditLog.
- Tạo quan hệ, index, unique constraint và migration.
- Tạo seed data.
- Thiết lập concurrency token và transaction cho luồng booking.

### Giai đoạn 3 – Authentication và phân quyền

- Đăng ký, đăng nhập, đăng xuất.
- JWT access token.
- Phân quyền Customer, Provider, Admin.
- Validation và xử lý lỗi thống nhất.

### Giai đoạn 4 – Provider module

- CRUD thông tin nhà cung cấp và dịch vụ.
- Provider lưu latitude và longitude thật cho Venue, hiển thị marker trên OpenStreetMap.
- Tạo, sửa, phát hành, tạm dừng slot.
- Cấu hình giá, số lượng, thời gian mở bán và thời hạn check-in.
- Dashboard quản lý slot và booking.
- Chỉ cho sửa slot ở trạng thái Draft hoặc Published chưa có booking xác nhận.

### Giai đoạn 5 – Customer discovery và booking

- Trang khám phá slot.
- Tìm kiếm, lọc, sắp xếp theo khoảng cách thật, giá, thời gian và danh mục.
- Hiển thị slot trên OpenStreetMap bằng marker; cho phép dùng vị trí hiện tại của trình duyệt khi Customer đồng ý.
- Chi tiết dịch vụ.
- Đặt chỗ, hủy chỗ, xem lịch sử.
- Sinh PIN/QR sau khi đặt thành công.

### Giai đoạn 6 – Luật chống lạm dụng

- Không cho đặt sau thời điểm đóng slot.
- Không cho đặt khi slot đã đầy hoặc hết hạn.
- Giới hạn booking đang hoạt động trên mỗi tài khoản.
- Ghi nhận hủy sát giờ và no-show.
- Tạm khóa hoặc giảm quyền đặt nếu vi phạm nhiều lần.
- Rate limit các API đặt chỗ.
- Provider luôn quyết định giá deal và giá sàn; hệ thống không tự giảm vô hạn.
- Background worker tự chuyển trạng thái slot/booking hết hạn và ghi audit log.

### Giai đoạn 7 – Check-in và hoàn tất dịch vụ

- Provider nhập PIN hoặc quét mã QR.
- Kiểm tra đúng slot, đúng thời gian và đúng trạng thái booking.
- Chuyển booking sang CheckedIn/Completed.
- Ghi nhận no-show khi quá thời hạn check-in.

### Giai đoạn 8 – Admin và moderation

- Quản lý người dùng, provider, dịch vụ và slot.
- Duyệt hoặc ẩn provider.
- Xem báo cáo vi phạm.
- Khóa/mở khóa tài khoản.
- Dashboard số liệu: slot phát hành, slot được đặt, tỷ lệ lấp đầy và no-show.

### Giai đoạn 9 – Frontend hoàn chỉnh

- Layout, navigation, loading state, empty state và error state.
- Responsive desktop/mobile.
- Form validation phía client và server.
- Toast notification và confirmation modal.
- Trang 404, unauthorized và forbidden.

### Giai đoạn 10 – Test, tài liệu và demo

- Unit test các luật booking, thời hạn và chống đặt trùng.
- Smoke test các luồng Customer/Provider/Admin.
- Kiểm tra concurrency khi hai tài khoản đặt cùng slot.
- Viết API documentation và hướng dẫn chạy local.
- Chuẩn bị tài khoản demo, dữ liệu demo và kịch bản trình bày.
- Review bảo mật cơ bản và hoàn thiện README.

## 6. Kế hoạch thời gian

- Tuần 1: Giai đoạn 0–3, database, authentication, phân quyền, seed data và Swagger.
- Tuần 2: Giai đoạn 4–6, Provider module, customer discovery, booking và anti-abuse rules.
- Tuần 3: Giai đoạn 7–9, check-in QR/PIN, Admin portal và hoàn thiện frontend responsive.
- Tuần 4: Giai đoạn 10, test, sửa lỗi, dữ liệu demo, README, demo script và review cuối.

## 7. Điều kiện hoàn thành MVP

- Ba luồng Customer, Provider và Admin chạy từ đầu đến cuối trên dữ liệu demo.
- Không thể đặt trùng hoặc đặt quá thời hạn slot.
- QR/PIN check-in và no-show hoạt động đúng theo mốc thời gian.
- API có Swagger, frontend responsive, validation và thông báo lỗi rõ ràng.
- Có migration, seed data, test cho booking rules và hướng dẫn chạy local.

## 8. Kết quả bàn giao

- Source code backend và frontend.
- Database SQLite và seed data.
- Swagger API documentation.
- Tài khoản demo cho ba vai trò.
- README hướng dẫn cài đặt/chạy project.
- Tài liệu nghiệp vụ và quy tắc chống lạm dụng.
- Bộ test và checklist demo.

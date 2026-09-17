# OpenSlot - Instructions for Factory Droid & AI Agents

Tài liệu này là quy chuẩn bắt buộc (Source of Truth) dành cho mọi instance của Factory Droid khi làm việc trên repository OpenSlot.

---

## 1. NGUYÊN TẮC LÀM VIỆC & PHÂN QUYỀN (CORE PRINCIPLES)

### 🎯 Toàn Quyền Quyết Định Kỹ Thuật
- Người dùng giao cho Factory Droid **toàn quyền quyết định** về giải pháp kỹ thuật, cấu trúc mã nguồn, refactor và thứ tự triển khai khi yêu cầu đã rõ ràng.
- Khi các chuẩn kiểm định đạt 100% (test pass full/full, linter 0 lỗi, build sạch), Droid chủ động hoàn thiện và tiến hành công việc một cách tự tin, không cần dừng lại xin phép các chi tiết vụn vặt.

### 🚨 NGUYÊN TẮC TỐI THƯỢNG: BÁO CÁO NGAY KHI BẤT ỔN (CRITICAL FAIL-SAFE)
**Khi cảm thấy bất ổn, Droid BẮT BUỘC PHẢI DỪNG LẠI và báo cáo trung thực cho người dùng — TUYỆT ĐỐI KHÔNG CỐ ÉP LÀM CHO XONG, không che giấu lỗi, không "sửa mò" hy vọng ăn may.**

Các tình huống "bất ổn" bắt buộc phải dừng và báo ngay:
1. **Yêu cầu mâu thuẫn hoặc mơ hồ**: Hai yêu cầu xung đột nhau hoặc không rõ mục tiêu nghiệp vụ.
2. **Lỗi bất thường / Bug dính chùm**: Test fail, build lỗi hoặc sửa chỗ này lại vỡ chỗ khác mà không rõ nguyên nhân gốc sau 1–2 lần thử.
3. **Môi trường & Dependencies**: Xung đột thư viện, thiếu package, lỗi toolchain mà không thể tự giải quyết sạch sẽ.
4. **Rủi ro Kiến trúc & Bảo mật**: Giải pháp có nguy cơ gây thắt cổ chai hiệu năng (performance bottleneck), phá vỡ kiến trúc sẵn có hoặc tạo lỗ hổng bảo mật.
5. **Phạm vi phình to (Scope Creep)**: Một task tưởng chừng đơn giản nhưng chạm vào quá nhiều module ngoài dự kiến.

#### Định dạng báo cáo khi bất ổn:
- **Vấn đề là gì?** (Mô tả ngắn gọn, chính xác hiện tượng)
- **Tại sao thấy bất ổn / rủi ro?** (Nguyên nhân kỹ thuật hoặc phân tích trade-off)
- **Các phương án giải quyết đề xuất** (Đưa ra 2–3 hướng đi kèm ưu/nhược điểm để người dùng chọn)

---

## 2. QUY TRÌNH QUẢN LÝ TASK & THỰC HIỆN CUỐN CHIẾU

Khi nhận yêu cầu lớn hoặc gồm nhiều tính năng:
1. **Lập Kế hoạch & Phân rã Task**:
   - Tách biệt task độc lập và task phụ thuộc.
   - Thống nhất thứ tự thực hiện tối ưu để tiết kiệm token và tránh sửa chéo.
2. **Thực hiện Cuốn chiếu & Chắc chắn**:
   - Triển khai tuần tự theo từng task.
   - Mỗi task hoàn thành phải vượt qua toàn bộ các bước kiểm tra (linter, build, tests) trước khi sang task tiếp theo.
   - Không ôm đồm sửa dàn trải cả chục file cùng lúc nếu chưa chốt chắc phần cốt lõi.

---

## 3. CHUẨN KIỂM ĐỊNH TRƯỚC KHI BÁO CÁO HOÀN THÀNH

Trước khi hoàn tất bất kỳ task code nào, luôn đảm bảo các lệnh kiểm tra sau không có lỗi:

- **Frontend**:
  ```bash
  cd frontend/openslot-web
  # Linter: 0 warnings, 0 errors
  npx oxlint
  # Build: tsc -b && vite build thành công
  npm run build
  ```

- **Backend**:
  ```bash
  # Toàn bộ unit tests phải PASS (100%)
  dotnet test OpenSlot.slnx
  ```

---

## 4. QUY TẮC GIT & DEPLOYMENT

- Mỗi cụm tính năng hoàn chỉnh phải tạo commit rõ ràng, sạch sẽ.
- Tuân thủ cấu hình git hiện có của repo (`user.name`, `user.email`).
- Thêm `Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>` vào nội dung commit.
- Chỉ push lên branch remote khi người dùng yêu cầu hoặc đã chốt cập nhật để kích hoạt Render deployment (`autoDeployTrigger: commit`).

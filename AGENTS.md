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

## 2. QUY TRÌNH TIẾP NHẬN YÊU CẦU & THỰC HIỆN CUỐN CHIẾU

### 📝 Nguyên Tắc Bắt Buộc: Viết Lại Prompt & Lên Plan Trước Khi Code (Planning First)
**Khi người dùng trình bày một vấn đề, báo lỗi hoặc yêu cầu tính năng mới:**
1. **TUYỆT ĐỐI KHÔNG nhảy vào sửa file hay viết code ngay lập tức.**
2. **Viết lại Prompt & Làm rõ bài toán**: Droid tự động phân tích và chuẩn hóa lại vấn đề:
   - **Hiện trạng & Vấn đề gốc rễ**: Hiện tượng lỗi là gì, code ở đâu đang xử lý chưa đúng.
   - **Mục tiêu kỹ thuật**: Cần đạt được điều gì, phạm vi chạm vào những module nào.
   - **Giải pháp đề xuất**: Nêu rõ hướng tiếp cận kỹ thuật.
3. **Lập Kế hoạch Triển khai Chi tiết (Plan)**:
   - Phân rã task rõ ràng (Task độc lập / Task phụ thuộc).
   - Thống nhất trình tự thực hiện để tiết kiệm token và tránh sửa chéo.
   - Trình bày kế hoạch cho người dùng duyệt (hoặc dùng Spec Mode / Todo List) trước khi đụng vào code.
4. **Chỉ khi kế hoạch được chốt hoặc người dùng đồng ý mới bắt đầu thực thi.**

### ⚙️ Thực Hiện Cuốn Chiếu & Chắc Chắn
- Triển khai tuần tự theo từng task đã lập trong kế hoạch.
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

# OpenSlot - Instructions for Factory Droid & AI Agents

Tài liệu này là quy chuẩn bắt buộc (Source of Truth) dành cho mọi instance của Factory Droid khi làm việc trên repository OpenSlot.

---

## 1. QUY TRÌNH QUẢN LÝ TASK & PHÊ DUYỆT TỪNG BƯỚC (BẮT BUỘC)

Khi người dùng đưa ra một yêu cầu gồm nhiều tính năng, nhiều task, hoặc yêu cầu có thể chia nhỏ (từ 2 subtasks trở lên, hoặc có phân tách giữa task độc lập và task phụ thuộc):

### 🚫 Điều cấm:
- **TUYỆT ĐỐI KHÔNG TỰ Ý CODE MỘT LÈO HẾT TẤT CẢ CÁC TASK** trong một lượt trả lời/execution dù yêu cầu có vẻ đơn giản hay dễ làm.

### ✅ Quy trình 4 bước bắt buộc:

1. **Phân tích & Phân loại Task**:
   - Liệt kê các task rõ ràng.
   - Phân loại rạch ròi:
     - **Task độc lập**: Những task không phụ thuộc vào nhau, có thể thực hiện riêng lẻ.
     - **Task phụ thuộc**: Những task cần kết quả của task trước mới làm được (nêu rõ điều kiện phụ thuộc).

2. **Lập Kế hoạch Chi tiết (Plan)**:
   - Mô tả giải pháp kỹ thuật cụ thể cho từng task (file tác động, logic thay đổi, giao diện bổ sung).
   - Gợi ý thứ tự triển khai tối ưu nhất.

3. **Chờ Người Dùng Xác Nhận & Chỉ Định**:
   - Trình bày bảng phân loại task và kế hoạch cho người dùng xem xét, góp ý hoặc điều chỉnh.
   - **CHỈ BẮT TAY VÀO CODE khi người dùng chỉ định rõ ràng** (ví dụ: *"làm Task A"*, *"tiến hành task 1"*, *"bắt đầu theo kế hoạch"*).

4. **Thực hiện Cuốn chiếu (Step-by-Step)**:
   - Chỉ thực hiện đúng scope của task được yêu cầu.
   - Sau khi hoàn thành task: chạy kiểm tra đầy đủ (linter, build, tests), báo cáo kết quả ngắn gọn và **dừng lại chờ người dùng ra lệnh cho task tiếp theo**.

---

## 2. CHUẨN KIỂM ĐỊNH TRƯỚC KHI BÁO CÁO HOÀN THÀNH

Trước khi hoàn tất bất kỳ task code nào, luôn đảm bảo các lệnh kiểm tra sau không có lỗi:

- **Frontend**:
  ```bash
  cd frontend/openslot-web
  npx oxlint          # Phải đạt 0 warnings, 0 errors
  npm run build       # tsc -b && vite build phải thành công
  ```

- **Backend**:
  ```bash
  dotnet test OpenSlot.slnx   # Toàn bộ unit tests phải PASS
  ```

---

## 3. QUY TẮC GIT & DEPLOYMENT

- Tuân thủ cấu hình git hiện có của repo (`user.name`, `user.email`).
- Thêm `Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>` vào nội dung commit.
- Chỉ push lên branch remote khi người dùng yêu cầu hoặc đã chốt cập nhật để kích hoạt Render deployment (`autoDeployTrigger: commit`).

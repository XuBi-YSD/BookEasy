# BookEasy — Demo đặt lịch hẹn & nhắc lịch cho dịch vụ nhỏ (spa/salon/phòng khám/gia sư)

Case study demo cho **Graph Build Service** (dịch vụ build công cụ nội bộ bằng mô hình 5-agent). Đây là app case study thứ 2, độc lập hoàn toàn với các app trước đó (YSD-DailyReport, YSD-QC, YSD-PM, SalesInvoiceApp, ViecBot).

Web app **client-side thuần** (HTML/CSS/JavaScript vanilla) — KHÔNG có backend/server, dữ liệu lưu trong `localStorage` của trình duyệt. Giao diện tiếng Việt, responsive cơ bản (có breakpoint cho màn hình ≤ 768px).

## 1. Cách mở app (2 cách)

### Cách 1 — Mở qua local web server (khuyến nghị)

```bash
cd "/Users/maitrongduy/Documents/Private Project/20260824-BookEasy-Demo"
python3 -m http.server 8791
```

Sau đó mở trình duyệt tới `http://127.0.0.1:8791/index.html` (hoặc `http://localhost:8791/index.html`).

### Cách 2 — Mở trực tiếp file (double-click)

Double-click file `index.html` trong Finder (hoặc mở bằng trình duyệt qua đường dẫn `file://`). App chạy được ngay không cần server, vì toàn bộ logic là JS thuần + `localStorage`.

**Lưu ý:** Cả 2 cách đều cần kết nối Internet để tải thư viện **ExcelJS** từ CDN (`cdn.jsdelivr.net`) — chỉ dùng cho tính năng xuất Excel. Nếu mất mạng, mọi tính năng khác (đặt lịch, quản trị, nhắc lịch) vẫn hoạt động bình thường, chỉ riêng xuất Excel sẽ báo lỗi rõ ràng trên UI (đã test và có thông báo fallback gợi ý dùng http.server nếu ExcelJS không tải được).

**Kết quả kiểm thử thực tế:** đã chạy toàn bộ luồng nghiệp vụ qua cả 2 cách mở app (dùng Playwright điều khiển trình duyệt Chromium thật), kết quả **giống hệt nhau, không có khác biệt** giữa server và `file://` — xem mục 4.

## 2. Tính năng đã hoàn thành

- **Cấu hình dịch vụ** (khu vực Quản trị): thêm/sửa/xoá dịch vụ (tên, thời lượng phút, giá tiền tuỳ chọn). Có seed data mẫu sẵn (Cắt tóc, Nhuộm tóc, Massage thư giãn, Chăm sóc da mặt, Khám tổng quát, Gia sư 1-1).
- **Cấu hình nhân viên** (khu vực Quản trị): thêm/sửa/xoá nhân viên. Seed sẵn 3 nhân viên mẫu.
- **Form đặt lịch hẹn** (khu vực Đặt lịch): chọn dịch vụ, chọn nhân viên phục vụ (tuỳ chọn — có thể để "bất kỳ"), ngày giờ, tên khách, số điện thoại (validate SĐT VN cơ bản: đúng 10 số, bắt đầu bằng 0), ghi chú.
- **Kiểm tra trùng lịch**: chặn đặt/sửa lịch nếu trùng khung giờ với **cùng một nhân viên** trong **cùng ngày**. Nếu không chọn nhân viên cụ thể, bỏ qua kiểm tra trùng (đúng theo spec gốc). Áp dụng cho cả đặt mới lẫn sửa lịch hẹn đã có.
- **Trang quản trị lịch hẹn**: xem theo dạng Danh sách (bảng) hoặc Lịch ngày (nhóm theo khung giờ), lọc theo ngày (mặc định hôm nay), sửa/xoá lịch hẹn (có hộp thoại xác nhận khi xoá), đổi trạng thái (Đã xác nhận / Đã huỷ / Hoàn thành) ngay tại chỗ.
- **Khối nhắc lịch nội bộ**: badge + panel ở header hiển thị số lượng và danh sách "Lịch hẹn hôm nay" còn hiệu lực (status = Đã xác nhận, chưa kết thúc), tự cập nhật ngay khi có thay đổi (thêm/sửa/xoá/đổi trạng thái) và làm mới định kỳ mỗi 30 giây.
- **Xuất Excel**: xuất danh sách lịch hẹn theo ngày đang xem, hoặc theo tuần (Thứ Hai → Chủ Nhật) chứa ngày đó, ra file `.xlsx` (dùng ExcelJS qua CDN), tên file có kèm ngày/tuần.
- **Responsive cơ bản**: có media query cho màn hình ≤ 768px (điện thoại).

## 3. Giả định & khoảng trống đã tự quyết định (Execution Agent tự quyết khi spec không nêu chi tiết)

Các điểm này được ghi lại rõ để **Reporting Agent** dùng làm căn cứ báo cáo case study — không phải lỗi, mà là quyết định thiết kế trong phạm vi MVP demo:

1. **Nhắc lịch = nội bộ trong UI, KHÔNG gửi SMS/Email/Zalo thật.** App client-side thuần/no-backend nên không khả thi để gửi tin nhắn thật. Điều này được ghi chú rõ ngay trong UI (footnote dưới panel nhắc lịch: "Nhắc lịch nội bộ trong ứng dụng — không gửi SMS/Email/Zalo") để tránh gây hiểu nhầm khi demo cho khách hàng.
2. **Dữ liệu demo mẫu (seed data)**: 6 dịch vụ + 3 nhân viên được nạp sẵn khi lần đầu mở app (chỉ khi `localStorage` chưa có key tương ứng — không ghi đè dữ liệu người dùng đã có). Danh sách lịch hẹn seed rỗng (không có lịch hẹn mẫu) để người dùng tự trải nghiệm luồng đặt lịch từ đầu.
3. **Namespace `localStorage`** (có version suffix để dễ nâng cấp schema sau này mà không đụng dữ liệu cũ):
   - `bookeasy_services_v1`
   - `bookeasy_staff_v1`
   - `bookeasy_appointments_v1`
4. **Không có backend/đồng bộ đa thiết bị**: dữ liệu chỉ lưu local trong trình duyệt đang dùng. Mở app trên máy/trình duyệt khác, hoặc ở chế độ ẩn danh, sẽ KHÔNG thấy cùng dữ liệu. Đây là giới hạn cố hữu của kiến trúc zero-infra (client-side thuần), không phải lỗi.
5. **Kiểm tra trùng lịch chỉ theo nhân viên**, không theo "chỗ/phòng" chung (spec gốc mục 3 chỉ yêu cầu theo nhân viên "nếu có chọn"). Quy tắc ranh giới: dùng khoảng nửa-mở `[start, end)` — nếu giờ kết thúc lịch A trùng đúng giờ bắt đầu lịch B thì KHÔNG coi là trùng (cho phép xếp lịch nối tiếp sát nhau).
6. **Không có xác thực/đăng nhập**: đây là bản demo, khu vực "Quản trị" không có phân quyền — ai mở app đều truy cập được. Phù hợp phạm vi MVP demo, không phù hợp để đưa vào sản xuất thật cho khách hàng mà không bổ sung thêm.
7. **Xuất Excel phụ thuộc CDN** (`cdn.jsdelivr.net` cho ExcelJS): cần Internet dù mở qua http.server hay `file://`. Đã test cả 2 cách, không có khác biệt.

## 4. Kết quả kiểm thử tích hợp thực tế (đã thực hiện, không chỉ mô tả)

Đã dùng Playwright điều khiển Chromium thật (không phải mô phỏng) để chạy toàn bộ luồng nghiệp vụ, chạy **2 lần độc lập**: một lần qua `http://127.0.0.1:8791/index.html` (python3 -m http.server), một lần qua `file:///.../index.html` (tương đương double-click mở file trực tiếp).

**Luồng đã test (đều PASS ở cả 2 cách mở app, kết quả giống hệt nhau):**

1. Seed data (dịch vụ/nhân viên mặc định) nạp đúng khi `localStorage` trống.
2. Thêm dịch vụ mới ở Quản trị → hiển thị đúng trong bảng + dropdown đặt lịch.
3. Thêm nhân viên mới ở Quản trị → hiển thị đúng trong bảng + dropdown đặt lịch.
4. Đặt lịch hẹn hợp lệ (chọn dịch vụ + nhân viên + ngày giờ + thông tin khách) → lưu thành công, thông báo đúng.
5. Đặt lịch trùng giờ + trùng nhân viên với lịch đã có → **bị chặn đúng**, thông báo lỗi rõ ràng (tên nhân viên, khung giờ xung đột, tên khách đang chiếm chỗ).
6. Đặt lịch trùng giờ nhưng KHÔNG chọn nhân viên cụ thể → **được phép** (đúng spec).
7. Trang quản trị hiển thị đúng số lượng lịch hẹn theo ngày lọc (danh sách dạng bảng).
8. Chuyển sang chế độ xem "Lịch ngày" (nhóm theo khung giờ) → hiển thị đúng.
9. Sửa lịch hẹn sang giờ gây trùng với lịch khác cùng nhân viên → **bị chặn đúng** (kiểm tra trùng lịch áp dụng lại khi sửa).
10. Sửa lịch hẹn hợp lệ (đổi ghi chú) → lưu thành công.
11. Đổi trạng thái lịch hẹn (Đã xác nhận → Hoàn thành) → cập nhật ngay trên UI, persist đúng.
12. Khối nhắc lịch (badge + panel):
    - Tăng đúng số lượng khi thêm lịch hẹn "hôm nay" (ngày thực của máy chạy test) còn hiệu lực.
    - Panel hiển thị đúng tên khách vừa đặt.
    - Giảm đúng số lượng khi đổi trạng thái lịch đó sang "Đã huỷ".
13. Xoá lịch hẹn (có hộp thoại xác nhận) → xoá đúng, số dòng giảm đúng 1.
14. Xuất Excel theo ngày → sự kiện download xảy ra, thông báo "Đã xuất ... lịch hẹn" đúng.
15. Xuất Excel theo tuần → tương tự, đúng khoảng Thứ Hai–Chủ Nhật chứa ngày đang lọc.
16. Không phát sinh console error/pageerror nào trong suốt luồng test (cả 2 cách mở app).

**Kiểm tra bổ sung nội dung file Excel xuất ra**: đã tải file `.xlsx` thật về và đọc lại bằng ExcelJS (không chỉ kiểm tra sự kiện download) — xác nhận đúng số dòng, đúng header tiếng Việt (Ngày/Giờ/Dịch vụ/Nhân viên/Khách hàng/SĐT/Trạng thái/Ghi chú), đúng dữ liệu khách hàng đã nhập. Test này cũng chạy cả 2 cách (server + file://), kết quả giống hệt nhau.

**Kết luận:** không phát hiện lỗi chặn nghiêm trọng nào trong toàn bộ luồng test ở cả 2 cách mở app. Không có khác biệt hành vi giữa http.server và file:// trong phạm vi đã test.

**Giới hạn của phần test này** (để Review Agent/Reporting Agent nắm rõ, không bị hiểu nhầm là đã bao phủ 100%):
- Test tự động dùng Playwright + Chromium — chưa test thủ công bằng mắt trên trình duyệt Safari hoặc trên thiết bị di động thật (chỉ xác nhận CSS có media query responsive, chưa chạy trên viewport mobile thật qua tay).
- Chưa test các trường hợp biên cực đoan (vd nhập ký tự đặc biệt/rất dài vào các trường text, đặt lịch ở đúng thời điểm giao ngày 23:59→00:00, nhiều tab/cửa sổ mở đồng thời cùng ghi `localStorage`).
- Đây là 1 lượt test thủ công/tự động toàn luồng theo đúng tiêu chí hoàn thành của task — không thay thế cho việc Review Agent tự kiểm tra độc lập bằng cách đọc code thật.

## 5. Cấu trúc thư mục

```
20260824-BookEasy-Demo/
├── index.html                  # Toàn bộ UI (form đặt lịch, khu vực quản trị, modal sửa lịch)
├── css/
│   └── style.css                # Toàn bộ style, có responsive @media (max-width: 768px)
├── js/
│   ├── storage.js                # Data model + localStorage helpers + logic kiểm tra trùng lịch dùng chung
│   ├── admin-config.js           # CRUD cấu hình Dịch vụ & Nhân viên
│   ├── booking-form.js           # Form đặt lịch hẹn + hook kiểm tra trùng lịch khi đặt mới
│   ├── admin-appointments.js     # Quản trị lịch hẹn: danh sách/lịch ngày, sửa/xoá/đổi trạng thái
│   ├── upcoming-reminders.js     # Khối nhắc lịch nội bộ (badge + panel ở header)
│   └── export-excel.js           # Xuất Excel ngày/tuần (dùng ExcelJS qua CDN)
└── README.md                    # File này
```

/* ============================================================
 * BookEasy — export-excel.js
 * Xuất danh sách lịch hẹn ra file Excel (.xlsx), 2 nút riêng ở khu vực
 * "Quản trị lịch hẹn":
 *   - "Xuất Excel ngày"  -> đúng ngày đang lọc ở apptFilterDate
 *   - "Xuất Excel tuần"  -> cả tuần (Thứ Hai -> Chủ Nhật) chứa ngày đó
 *
 * Cột xuất (tiếng Việt): Ngày, Giờ, Dịch vụ, Nhân viên, Khách hàng,
 * SĐT, Trạng thái, Ghi chú.
 *
 * Tham chiếu pattern (theo yêu cầu task, xem YSD-DailyReport):
 *   - Nạp ExcelJS qua CDN: index.html
 *     <script src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>
 *   - workbook.xlsx.writeBuffer() + Blob + URL.createObjectURL để tải
 *     file: ~/Documents/YSD-DailyReport/js/app.js dòng 635-639 (downloadBuffer)
 *     và dòng 658-668 (gọi writeBuffer rồi downloadBuffer).
 *
 * Đọc dữ liệu qua js/storage.js (BookEasyStorage) — không tự quản lý
 * localStorage trực tiếp ở file này. File này KHÔNG phụ thuộc vào các
 * biến nội bộ (closure) của js/admin-appointments.js — chỉ đọc DOM
 * (#apptFilterDate) và BookEasyStorage, nên có thể nạp độc lập.
 * ============================================================ */

(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!global.BookEasyStorage) {
      console.error('[BookEasy export-excel] BookEasyStorage chưa được nạp (thiếu js/storage.js?).');
      return;
    }
    if (!global.ExcelJS) {
      console.error('[BookEasy export-excel] ExcelJS chưa được nạp được từ CDN (kiểm tra kết nối mạng tới cdn.jsdelivr.net).');
    }
    initExportExcel();
  });

  // ---------- Tiện ích dùng chung (bản độc lập, không phụ thuộc closure của admin-appointments.js) ----------

  var STATUS_LABELS = {
    confirmed: 'Đã xác nhận',
    cancelled: 'Đã huỷ',
    completed: 'Hoàn thành'
  };

  function statusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function formatDateVN(iso) {
    var parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function isoDateFromDate(d) {
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function todayISODate() {
    return isoDateFromDate(new Date());
  }

  // Parse 'YYYY-MM-DD' thành Date ở giờ local 00:00 — tránh lệch ngày do
  // new Date('YYYY-MM-DD') mặc định parse theo UTC (có thể lùi 1 ngày ở
  // múi giờ VN khi hiển thị lại qua getDate()/getDay()).
  function parseISODate(iso) {
    var parts = String(iso).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  // Khoảng tuần (Thứ Hai -> Chủ Nhật) chứa ngày iso đã cho.
  function getWeekRange(iso) {
    var d = parseISODate(iso);
    var dow = d.getDay(); // 0 = Chủ Nhật, 1 = Thứ Hai, ..., 6 = Thứ Bảy
    var diffToMonday = (dow === 0) ? -6 : (1 - dow);
    var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
    var sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { start: isoDateFromDate(monday), end: isoDateFromDate(sunday) };
  }

  function getServiceById(id) {
    return global.BookEasyStorage.getServices().filter(function (s) { return s.id === id; })[0] || null;
  }

  function getStaffById(id) {
    if (!id) return null;
    return global.BookEasyStorage.getStaff().filter(function (s) { return s.id === id; })[0] || null;
  }

  function serviceLabel(appt) {
    var svc = getServiceById(appt.serviceId);
    return svc ? svc.name : '(dịch vụ đã bị xoá)';
  }

  function staffLabel(appt) {
    if (!appt.staffId) return '—';
    var person = getStaffById(appt.staffId);
    return person ? person.name : '(nhân viên đã bị xoá)';
  }

  function sortByDateTime(appts) {
    var list = appts.slice();
    list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return global.BookEasyStorage.timeToMinutes(a.startTime) - global.BookEasyStorage.timeToMinutes(b.startTime);
    });
    return list;
  }

  function isoToSlug(iso) {
    return String(iso).replace(/-/g, '');
  }

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'form-msg' + (kind ? ' form-msg-' + kind : '');
  }

  // ---------- Xây dựng workbook ExcelJS ----------

  function buildWorkbook(appointments, sheetName) {
    var workbook = new global.ExcelJS.Workbook();
    var sheet = workbook.addWorksheet((sheetName || 'Lịch hẹn').slice(0, 31)); // Excel giới hạn tên sheet <= 31 ký tự

    sheet.columns = [
      { header: 'Ngày', key: 'date', width: 12 },
      { header: 'Giờ', key: 'time', width: 14 },
      { header: 'Dịch vụ', key: 'service', width: 24 },
      { header: 'Nhân viên', key: 'staff', width: 18 },
      { header: 'Khách hàng', key: 'customer', width: 22 },
      { header: 'SĐT', key: 'phone', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 14 },
      { header: 'Ghi chú', key: 'note', width: 32 }
    ];

    var headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.eachCell(function (cell) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE7FE' } };
    });

    appointments.forEach(function (appt) {
      sheet.addRow({
        date: formatDateVN(appt.date),
        time: appt.startTime + '–' + appt.endTime,
        service: serviceLabel(appt),
        staff: staffLabel(appt),
        customer: appt.customerName,
        phone: appt.phone,
        status: statusLabel(appt.status),
        note: appt.note || ''
      });
    });

    return workbook;
  }

  // Blob + URL.createObjectURL để tải file — theo đúng pattern
  // downloadBuffer() ở YSD-DailyReport js/app.js dòng 635-639.
  function downloadBuffer(buffer, filename) {
    var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- Xuất theo ngày đang xem ----------

  function exportDay(dateISO, msgEl) {
    if (!global.ExcelJS) {
      setMsg(msgEl, 'Không thể xuất Excel: thư viện ExcelJS chưa nạp được (kiểm tra kết nối mạng tới CDN, hoặc thử mở qua "python3 -m http.server" thay vì mở file trực tiếp).', 'err');
      return;
    }
    var appts = sortByDateTime(global.BookEasyStorage.getAppointments().filter(function (a) {
      return a.date === dateISO;
    }));
    if (!appts.length) {
      setMsg(msgEl, 'Không có lịch hẹn nào trong ngày ' + formatDateVN(dateISO) + ' để xuất.', 'err');
      return;
    }
    var workbook = buildWorkbook(appts, 'Lich hen ' + dateISO);
    workbook.xlsx.writeBuffer().then(function (buf) {
      downloadBuffer(buf, 'BookEasy-LichHen-Ngay-' + isoToSlug(dateISO) + '.xlsx');
      setMsg(msgEl, 'Đã xuất ' + appts.length + ' lịch hẹn ngày ' + formatDateVN(dateISO) + ' ra file Excel.', 'ok');
    }).catch(function (err) {
      console.error(err);
      setMsg(msgEl, 'Lỗi khi tạo file Excel: ' + (err && err.message ? err.message : err), 'err');
    });
  }

  // ---------- Xuất theo tuần hiện tại (chứa ngày đang lọc) ----------

  function exportWeek(dateISO, msgEl) {
    if (!global.ExcelJS) {
      setMsg(msgEl, 'Không thể xuất Excel: thư viện ExcelJS chưa nạp được (kiểm tra kết nối mạng tới CDN, hoặc thử mở qua "python3 -m http.server" thay vì mở file trực tiếp).', 'err');
      return;
    }
    var range = getWeekRange(dateISO);
    var appts = sortByDateTime(global.BookEasyStorage.getAppointments().filter(function (a) {
      return a.date >= range.start && a.date <= range.end;
    }));
    if (!appts.length) {
      setMsg(msgEl, 'Không có lịch hẹn nào trong tuần ' + formatDateVN(range.start) + ' – ' + formatDateVN(range.end) + ' để xuất.', 'err');
      return;
    }
    var workbook = buildWorkbook(appts, 'Lich hen tuan ' + range.start + '-' + range.end);
    workbook.xlsx.writeBuffer().then(function (buf) {
      downloadBuffer(buf, 'BookEasy-LichHen-Tuan-' + isoToSlug(range.start) + '-' + isoToSlug(range.end) + '.xlsx');
      setMsg(msgEl, 'Đã xuất ' + appts.length + ' lịch hẹn tuần ' + formatDateVN(range.start) + ' – ' + formatDateVN(range.end) + ' ra file Excel.', 'ok');
    }).catch(function (err) {
      console.error(err);
      setMsg(msgEl, 'Lỗi khi tạo file Excel: ' + (err && err.message ? err.message : err), 'err');
    });
  }

  // ---------- Khởi tạo: gắn sự kiện cho 2 nút xuất Excel ----------

  function initExportExcel() {
    var filterDateInput = document.getElementById('apptFilterDate');
    var exportDayBtn = document.getElementById('apptExportDayBtn');
    var exportWeekBtn = document.getElementById('apptExportWeekBtn');
    var msgEl = document.getElementById('apptExportMsg');

    if (!filterDateInput || !exportDayBtn || !exportWeekBtn) return; // khu vực chưa có trong DOM (an toàn nếu HTML thay đổi)

    function currentFilterDate() {
      return filterDateInput.value || todayISODate();
    }

    exportDayBtn.addEventListener('click', function () {
      exportDay(currentFilterDate(), msgEl);
    });

    exportWeekBtn.addEventListener('click', function () {
      exportWeek(currentFilterDate(), msgEl);
    });
  }

  // Export ra global để tiện kiểm thử độc lập (vd Review Agent test qua console) — không bắt buộc để app chạy.
  global.BookEasyExportExcel = {
    getWeekRange: getWeekRange,
    buildWorkbook: buildWorkbook,
    exportDay: exportDay,
    exportWeek: exportWeek
  };

})(window);

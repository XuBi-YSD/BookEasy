/* ============================================================
 * BookEasy — storage.js
 * Data model + localStorage helpers (namespaced + versioned)
 * Pattern tham chiếu: YSD-QC ysdqc_droplist_overrides_v1,
 *                      YSD-PM i18n.js (localStorage key có version suffix)
 * ============================================================
 *
 * Data model:
 *  - service:     { id, name, durationMinutes, price }        // price optional (null cho phép)
 *  - staff:       { id, name }
 *  - appointment: {
 *      id, serviceId, staffId, customerName, phone, note,
 *      date,        // 'YYYY-MM-DD'
 *      startTime,   // 'HH:mm'
 *      duration,    // số phút (copy từ service tại thời điểm đặt, để đổi dịch vụ sau này không ảnh hưởng lịch cũ)
 *      endTime,     // 'HH:mm' — tính sẵn từ startTime + duration để tiện kiểm tra trùng lịch
 *      status       // 'confirmed' | 'cancelled' | 'completed'
 *    }
 * ============================================================ */

(function (global) {
  'use strict';

  var STORAGE_KEYS = {
    appointments: 'bookeasy_appointments_v1',
    services: 'bookeasy_services_v1',
    staff: 'bookeasy_staff_v1'
  };

  var STATUS = {
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed'
  };

  // ---------- Generic get/set (JSON.parse/stringify qua localStorage) ----------

  function readList(key) {
    var raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[BookEasy storage] Lỗi parse JSON cho key "' + key + '":', e);
      return [];
    }
  }

  function writeList(key, list) {
    localStorage.setItem(key, JSON.stringify(list || []));
  }

  // ---------- Services ----------

  function getServices() {
    return readList(STORAGE_KEYS.services) || [];
  }

  function setServices(list) {
    writeList(STORAGE_KEYS.services, list);
  }

  // ---------- Staff ----------

  function getStaff() {
    return readList(STORAGE_KEYS.staff) || [];
  }

  function setStaff(list) {
    writeList(STORAGE_KEYS.staff, list);
  }

  // ---------- Appointments ----------

  function getAppointments() {
    return readList(STORAGE_KEYS.appointments) || [];
  }

  function setAppointments(list) {
    writeList(STORAGE_KEYS.appointments, list);
    // Phát sự kiện để các khối UI khác (vd khối "Lịch hẹn sắp tới" ở
    // js/upcoming-reminders.js) tự cập nhật ngay khi appointments thay đổi
    // (thêm/sửa/xoá/đổi trạng thái), không cần polling liên tục.
    if (global.dispatchEvent) {
      global.dispatchEvent(new CustomEvent('bookeasy:appointments-changed'));
    }
  }

  // ---------- Tiện ích ----------

  function generateId(prefix) {
    var rand = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '_' + Date.now().toString(36) + rand;
  }

  // Cộng phút vào 'HH:mm' -> 'HH:mm' (dùng để tính endTime)
  function addMinutesToTime(hhmm, minutes) {
    var parts = String(hhmm).split(':');
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    var total = h * 60 + m + (parseInt(minutes, 10) || 0);
    total = ((total % 1440) + 1440) % 1440; // giữ trong phạm vi 1 ngày
    var eh = Math.floor(total / 60);
    var em = total % 60;
    return (eh < 10 ? '0' + eh : '' + eh) + ':' + (em < 10 ? '0' + em : '' + em);
  }

  // ---------- Kiểm tra trùng lịch theo nhân viên (T4) ----------
  //
  // Hàm dùng chung cho CẢ form đặt lịch (T3, booking-form.js) LẪN luồng
  // sửa lịch hẹn ở trang quản trị (T5, khi được xây dựng) — đặt ở đây
  // (storage.js) thay vì lặp lại logic ở từng nơi gọi.
  //
  // QUY TẮC OVERLAP (khoảng nửa-mở [start, end)):
  //   2 khung giờ chồng lấn  <=>  candStart < existEnd  VÀ  existStart < candEnd
  // Vì dùng khoảng NỬA-MỞ (end không tính là còn "đang diễn ra"), nên nếu
  // giờ KẾT THÚC của lịch A trùng đúng giờ BẮT ĐẦU của lịch B (endA === startB)
  // thì hai lịch này ĐƯỢC XEM LÀ KHÔNG CHỒNG LẤN — cho phép nhân viên nhận
  // lịch kế tiếp ngay sau khi lịch trước kết thúc (vd 9:00–9:30 và 9:30–10:00
  // là hợp lệ, không bị chặn). Đây là quy tắc được áp dụng NHẤT QUÁN cho mọi
  // trường hợp ranh giới trong toàn bộ app (đặt mới lẫn sửa lịch).
  //
  // Chỉ kiểm tra khi CÙNG NGÀY (date) + CÙNG staffId. Nếu candidate.staffId
  // rỗng/null (không chọn nhân viên phục vụ) thì BỎ QUA HOÀN TOÀN bước kiểm
  // tra trùng theo nhân viên, đúng spec mục 3 "nếu có chọn nhân viên phục vụ".
  //
  // Lịch hẹn đã bị huỷ (status === CANCELLED) không được tính là đang chiếm
  // chỗ của nhân viên, nên bị loại khỏi danh sách so sánh.

  function timeToMinutes(hhmm) {
    var parts = String(hhmm).split(':');
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }

  // Lịch hẹn có vắt qua nửa đêm không (startTime + duration > cuối ngày)?
  // Dùng để CHẶN việc tạo/sửa lịch hẹn loại này ngay từ đầu (booking-form.js,
  // admin-appointments.js) thay vì cố xử lý so sánh overlap 2 lịch nằm ở
  // 2 ngày thực tế khác nhau nhưng có thể trùng cùng giá trị field `date`
  // (vd 23:30 ngày X kéo sang 00:30 *ngày X+1* — không phải cùng thời điểm
  // với 00:15 *ngày X* dù cùng lưu chung field date="X"). Với quy mô MVP
  // (spa/salon/phòng khám giờ hành chính), chặn thẳng đơn giản và an toàn
  // hơn nhiều so với tự suy diễn ngày kế tiếp.
  function wouldCrossMidnight(startTime, durationMinutes) {
    return timeToMinutes(startTime) + (parseInt(durationMinutes, 10) || 0) > 1440;
  }

  // candidate: appointment đang xét (đã có date/startTime/endTime/staffId)
  // existingAppointments: danh sách appointment hiện có để so sánh
  // excludeId (tuỳ chọn): id của chính appointment đang sửa — dùng khi T5
  //   sửa 1 lịch hẹn đang tồn tại, để không tự so sánh nó với chính nó.
  // Trả về: appointment đầu tiên bị trùng, hoặc null nếu không trùng.
  function findScheduleConflict(candidate, existingAppointments, excludeId) {
    if (!candidate || !candidate.staffId) return null; // không chọn nhân viên -> bỏ qua kiểm tra theo staff

    var candStart = timeToMinutes(candidate.startTime);
    // Cộng thẳng duration vào candStart thay vì đọc lại endTime — endTime là chuỗi
    // 'HH:mm' đã bị wrap qua modulo 1440 ở addMinutesToTime() nên với lịch hẹn vắt
    // qua nửa đêm (vd 23:30 + 60' -> endTime "00:30"), việc parse lại "00:30" thành
    // 30 phút (thay vì 1470) từng khiến candEnd < candStart -> so sánh overlap sai,
    // bỏ lọt trùng lịch thật (bug đã được Review Agent phát hiện, xem README).
    var candEnd = candStart + (parseInt(candidate.duration, 10) || 0);
    var list = existingAppointments || [];

    for (var i = 0; i < list.length; i++) {
      var appt = list[i];
      if (!appt) continue;
      if (excludeId && appt.id === excludeId) continue; // bỏ qua chính lịch đang sửa
      if (appt.status === STATUS.CANCELLED) continue; // lịch đã huỷ không chiếm chỗ
      if (appt.staffId !== candidate.staffId) continue;
      if (appt.date !== candidate.date) continue;

      var existStart = timeToMinutes(appt.startTime);
      var existEnd = existStart + (parseInt(appt.duration, 10) || (timeToMinutes(appt.endTime) - existStart + 1440) % 1440);

      // Overlap nửa-mở: xem comment quy tắc ở trên (ranh giới end===start -> KHÔNG trùng).
      if (candStart < existEnd && existStart < candEnd) {
        return appt;
      }
    }
    return null;
  }

  // ---------- Seed data mẫu ----------
  // Chỉ ghi seed khi key CHƯA TỒN TẠI trong localStorage (không đè dữ liệu đã có sau reload).

  var SEED_SERVICES = [
    { id: 'svc_haircut', name: 'Cắt tóc', durationMinutes: 30, price: 100000 },
    { id: 'svc_hairdye', name: 'Nhuộm tóc', durationMinutes: 90, price: 350000 },
    { id: 'svc_massage', name: 'Massage thư giãn', durationMinutes: 60, price: 250000 },
    { id: 'svc_facial', name: 'Chăm sóc da mặt', durationMinutes: 45, price: 300000 },
    { id: 'svc_checkup', name: 'Khám tổng quát', durationMinutes: 30, price: 200000 },
    { id: 'svc_tutor', name: 'Gia sư 1-1', durationMinutes: 60, price: 150000 }
  ];

  var SEED_STAFF = [
    { id: 'staff_1', name: 'Nguyễn Thị A' },
    { id: 'staff_2', name: 'Trần Văn B' },
    { id: 'staff_3', name: 'Lê Thị C' }
  ];

  var SEED_APPOINTMENTS = [];

  function seedIfEmpty() {
    if (localStorage.getItem(STORAGE_KEYS.services) === null) {
      setServices(SEED_SERVICES);
    }
    if (localStorage.getItem(STORAGE_KEYS.staff) === null) {
      setStaff(SEED_STAFF);
    }
    if (localStorage.getItem(STORAGE_KEYS.appointments) === null) {
      setAppointments(SEED_APPOINTMENTS);
    }
  }

  // Tự chạy seed ngay khi file được nạp
  seedIfEmpty();

  // ---------- Export ra global (namespace BookEasyStorage) ----------

  global.BookEasyStorage = {
    KEYS: STORAGE_KEYS,
    STATUS: STATUS,
    getServices: getServices,
    setServices: setServices,
    getStaff: getStaff,
    setStaff: setStaff,
    getAppointments: getAppointments,
    setAppointments: setAppointments,
    generateId: generateId,
    addMinutesToTime: addMinutesToTime,
    timeToMinutes: timeToMinutes,
    wouldCrossMidnight: wouldCrossMidnight,
    findScheduleConflict: findScheduleConflict,
    seedIfEmpty: seedIfEmpty
  };
})(window);

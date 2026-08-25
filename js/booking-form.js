/* ============================================================
 * BookEasy — booking-form.js
 * Form đặt lịch hẹn (khu vực "Đặt lịch"): chọn dịch vụ, nhân viên
 * (tuỳ chọn), ngày giờ, thông tin khách hàng.
 * Đọc/ghi dữ liệu qua js/storage.js (BookEasyStorage) — không tự
 * quản lý localStorage trực tiếp ở file này.
 *
 * KIỂM TRA TRÙNG LỊCH (T4):
 * checkScheduleConflict() bên dưới là HOOK được gọi ngay trước khi lưu
 * appointment thật vào localStorage. Logic overlap thời gian thật sự
 * (so sánh theo date + startTime/endTime + staffId, quy tắc ranh giới
 * end===start, bỏ qua khi không chọn nhân viên...) nằm ở hàm dùng chung
 * BookEasyStorage.findScheduleConflict() trong js/storage.js — xem
 * comment chi tiết ở đó. Hàm này chỉ gọi lại + format thông báo lỗi.
 * ============================================================ */

(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!global.BookEasyStorage) {
      console.error('[BookEasy booking-form] BookEasyStorage chưa được nạp (thiếu js/storage.js?).');
      return;
    }
    initBookingForm();
  });

  // ---------- Hook kiểm tra trùng lịch (T4, đã cài đặt) ----------

  function checkScheduleConflict(candidateAppointment, existingAppointments) {
    var conflictAppt = global.BookEasyStorage.findScheduleConflict(candidateAppointment, existingAppointments);
    if (!conflictAppt) return { conflict: false, message: '' };

    var staffList = global.BookEasyStorage.getStaff();
    var staffObj = staffList.filter(function (s) { return s.id === conflictAppt.staffId; })[0];
    var staffName = staffObj ? staffObj.name : 'nhân viên đã chọn';

    return {
      conflict: true,
      message: 'Trùng lịch: nhân viên "' + staffName + '" đã có lịch hẹn từ ' +
        conflictAppt.startTime + ' đến ' + conflictAppt.endTime + ' ngày ' + conflictAppt.date +
        ' (khách "' + conflictAppt.customerName + '"). Vui lòng chọn giờ khác hoặc đổi nhân viên.'
    };
  }

  // ---------- Tiện ích ----------

  function setMsg(el, text, kind) {
    el.textContent = text || '';
    el.className = 'form-msg' + (kind ? ' form-msg-' + kind : '');
  }

  function todayISODate() {
    var d = new Date();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }

  // Chuẩn hoá + kiểm tra SĐT Việt Nam cơ bản: đúng 10 số, bắt đầu bằng số 0.
  function isValidVNPhone(phone) {
    var cleaned = phone.replace(/[\s.\-]/g, '');
    return /^0\d{9}$/.test(cleaned);
  }

  // ---------- Form đặt lịch ----------

  function initBookingForm() {
    var form = document.getElementById('bookingForm');
    if (!form) return;

    var serviceSelect = document.getElementById('bookingService');
    var staffSelect = document.getElementById('bookingStaff');
    var dateInput = document.getElementById('bookingDate');
    var timeInput = document.getElementById('bookingTime');
    var nameInput = document.getElementById('bookingCustomerName');
    var phoneInput = document.getElementById('bookingPhone');
    var noteInput = document.getElementById('bookingNote');
    var submitBtn = document.getElementById('bookingSubmitBtn');
    var msgEl = document.getElementById('bookingFormMsg');
    var noServicesNote = document.getElementById('bookingNoServicesNote');

    dateInput.min = todayISODate();

    function renderServiceOptions() {
      var services = global.BookEasyStorage.getServices();
      var prevValue = serviceSelect.value;

      serviceSelect.innerHTML = '';

      if (!services.length) {
        var emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— Chưa có dịch vụ nào —';
        serviceSelect.appendChild(emptyOpt);
        serviceSelect.disabled = true;
        submitBtn.disabled = true;
        noServicesNote.hidden = false;
        return;
      }

      serviceSelect.disabled = false;
      submitBtn.disabled = false;
      noServicesNote.hidden = true;

      var placeholderOpt = document.createElement('option');
      placeholderOpt.value = '';
      placeholderOpt.textContent = '— Chọn dịch vụ —';
      serviceSelect.appendChild(placeholderOpt);

      services.forEach(function (svc) {
        var opt = document.createElement('option');
        opt.value = svc.id;
        var priceText = (svc.price === null || svc.price === undefined || svc.price === '')
          ? ''
          : ' — ' + Number(svc.price).toLocaleString('vi-VN') + ' đ';
        opt.textContent = svc.name + ' (' + svc.durationMinutes + ' phút)' + priceText;
        serviceSelect.appendChild(opt);
      });

      if (prevValue && services.some(function (s) { return s.id === prevValue; })) {
        serviceSelect.value = prevValue;
      }
    }

    function renderStaffOptions() {
      var staff = global.BookEasyStorage.getStaff();
      var prevValue = staffSelect.value;

      staffSelect.innerHTML = '';

      var anyOpt = document.createElement('option');
      anyOpt.value = '';
      anyOpt.textContent = 'Không yêu cầu / bất kỳ nhân viên nào';
      staffSelect.appendChild(anyOpt);

      staff.forEach(function (person) {
        var opt = document.createElement('option');
        opt.value = person.id;
        opt.textContent = person.name;
        staffSelect.appendChild(opt);
      });

      if (prevValue && staff.some(function (s) { return s.id === prevValue; })) {
        staffSelect.value = prevValue;
      }
    }

    function renderDropdowns() {
      renderServiceOptions();
      renderStaffOptions();
    }

    // Nạp lại dropdown mỗi khi người dùng quay lại tab "Đặt lịch" — đảm bảo
    // phản ánh đúng thay đổi vừa cấu hình ở khu vực Quản trị (T2).
    document.querySelectorAll('#mainNav .nav-btn[data-view="booking"]').forEach(function (btn) {
      btn.addEventListener('click', renderDropdowns);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var serviceId = serviceSelect.value;
      var staffId = staffSelect.value || null;
      var date = dateInput.value;
      var time = timeInput.value;
      var customerName = nameInput.value.trim();
      var phoneRaw = phoneInput.value.trim();
      var note = noteInput.value.trim();

      if (!serviceId) { setMsg(msgEl, 'Vui lòng chọn dịch vụ.', 'err'); return; }
      if (!date) { setMsg(msgEl, 'Vui lòng chọn ngày hẹn.', 'err'); return; }
      if (!time) { setMsg(msgEl, 'Vui lòng chọn giờ hẹn.', 'err'); return; }
      if (!customerName) { setMsg(msgEl, 'Vui lòng nhập tên khách hàng.', 'err'); nameInput.focus(); return; }
      if (!phoneRaw) { setMsg(msgEl, 'Vui lòng nhập số điện thoại.', 'err'); phoneInput.focus(); return; }
      if (!isValidVNPhone(phoneRaw)) {
        setMsg(msgEl, 'Số điện thoại không hợp lệ (yêu cầu đúng 10 số, bắt đầu bằng số 0).', 'err');
        phoneInput.focus();
        return;
      }

      var services = global.BookEasyStorage.getServices();
      var service = services.filter(function (s) { return s.id === serviceId; })[0];
      if (!service) { setMsg(msgEl, 'Dịch vụ đã chọn không còn tồn tại, vui lòng chọn lại.', 'err'); renderServiceOptions(); return; }

      if (global.BookEasyStorage.wouldCrossMidnight(time, service.durationMinutes)) {
        setMsg(msgEl, 'Giờ hẹn + thời lượng dịch vụ ("' + service.name + '", ' + service.durationMinutes +
          ' phút) sẽ vắt qua nửa đêm — vui lòng chọn giờ sớm hơn trong ngày.', 'err');
        return;
      }

      var candidateAppointment = {
        id: global.BookEasyStorage.generateId('appt'),
        serviceId: service.id,
        staffId: staffId,
        customerName: customerName,
        phone: phoneRaw,
        note: note,
        date: date,
        startTime: time,
        duration: service.durationMinutes,
        endTime: global.BookEasyStorage.addMinutesToTime(time, service.durationMinutes),
        status: global.BookEasyStorage.STATUS.CONFIRMED
      };

      var existingAppointments = global.BookEasyStorage.getAppointments();

      // HOOK cho T4 (kiểm tra trùng lịch) — xem ghi chú đầu file.
      var conflictResult = checkScheduleConflict(candidateAppointment, existingAppointments);
      if (conflictResult && conflictResult.conflict) {
        setMsg(msgEl, conflictResult.message || 'Khung giờ này đã có lịch hẹn khác, vui lòng chọn giờ khác.', 'err');
        return;
      }

      existingAppointments.push(candidateAppointment);
      global.BookEasyStorage.setAppointments(existingAppointments);

      setMsg(msgEl, 'Đã đặt lịch hẹn cho "' + customerName + '" lúc ' + time + ' ngày ' + date + '.', 'ok');

      form.reset();
      dateInput.min = todayISODate();
      renderDropdowns();
    });

    renderDropdowns();
  }

})(window);

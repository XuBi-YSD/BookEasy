/* ============================================================
 * BookEasy — admin-appointments.js
 * Khu vực "Quản trị lịch hẹn" (T5): danh sách/lịch ngày, lọc theo
 * ngày (mặc định hôm nay), sửa (áp dụng lại kiểm tra trùng lịch T4
 * nếu đổi giờ/nhân viên), xoá (có confirm dialog), đổi trạng thái
 * (Đã xác nhận / Đã huỷ / Hoàn thành) — persist qua localStorage.
 *
 * Đọc/ghi dữ liệu qua js/storage.js (BookEasyStorage) — không tự
 * quản lý localStorage trực tiếp ở file này.
 *
 * KIỂM TRA TRÙNG LỊCH khi SỬA: dùng lại đúng hàm dùng chung
 * BookEasyStorage.findScheduleConflict(candidate, existingAppointments, excludeId)
 * đã có sẵn ở js/storage.js (cùng hàm mà booking-form.js dùng khi đặt
 * mới) — truyền excludeId = id của chính lịch đang sửa để không tự
 * so sánh nó với chính nó.
 * ============================================================ */

(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!global.BookEasyStorage) {
      console.error('[BookEasy admin-appointments] BookEasyStorage chưa được nạp (thiếu js/storage.js?).');
      return;
    }
    initAppointmentsAdmin();
  });

  // ---------- Tiện ích dùng chung ----------

  function todayISODate() {
    var d = new Date();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function isValidVNPhone(phone) {
    var cleaned = phone.replace(/[\s.\-]/g, '');
    return /^0\d{9}$/.test(cleaned);
  }

  function setMsg(el, text, kind) {
    el.textContent = text || '';
    el.className = 'form-msg' + (kind ? ' form-msg-' + kind : '');
  }

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

  // ---------- Khởi tạo khu vực Quản trị lịch hẹn ----------

  function initAppointmentsAdmin() {
    var filterDateInput = document.getElementById('apptFilterDate');
    var todayBtn = document.getElementById('apptFilterTodayBtn');
    var viewListBtn = document.getElementById('apptViewListBtn');
    var viewDayBtn = document.getElementById('apptViewDayBtn');
    var table = document.getElementById('apptTable');
    var tbody = document.getElementById('apptTableBody');
    var dayView = document.getElementById('apptDayView');
    var emptyNote = document.getElementById('apptEmptyNote');

    if (!filterDateInput || !tbody) return; // khu vực chưa có trong DOM (an toàn nếu HTML thay đổi)

    // ---- modal sửa lịch hẹn ----
    var overlay = document.getElementById('apptEditOverlay');
    var editForm = document.getElementById('apptEditForm');
    var editIdInput = document.getElementById('apptEditId');
    var editServiceSelect = document.getElementById('apptEditService');
    var editStaffSelect = document.getElementById('apptEditStaff');
    var editDateInput = document.getElementById('apptEditDate');
    var editTimeInput = document.getElementById('apptEditTime');
    var editNameInput = document.getElementById('apptEditCustomerName');
    var editPhoneInput = document.getElementById('apptEditPhone');
    var editNoteInput = document.getElementById('apptEditNote');
    var editMsgEl = document.getElementById('apptEditFormMsg');
    var editCloseBtn = document.getElementById('apptEditCloseBtn');
    var editCancelBtn = document.getElementById('apptEditCancelBtn');

    var viewMode = 'list'; // 'list' | 'day'

    filterDateInput.value = todayISODate();

    // ---------- Đọc dữ liệu cho ngày đang lọc ----------

    function getAppointmentsForSelectedDate() {
      var date = filterDateInput.value || todayISODate();
      var appts = global.BookEasyStorage.getAppointments().filter(function (a) {
        return a.date === date;
      });
      appts.sort(function (a, b) {
        return global.BookEasyStorage.timeToMinutes(a.startTime) - global.BookEasyStorage.timeToMinutes(b.startTime);
      });
      return appts;
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

    // ---------- Đổi trạng thái ----------

    function buildStatusSelect(appt) {
      var sel = document.createElement('select');
      sel.className = 'status-select status-' + appt.status;
      ['confirmed', 'completed', 'cancelled'].forEach(function (statusValue) {
        var opt = document.createElement('option');
        opt.value = statusValue;
        opt.textContent = statusLabel(statusValue);
        if (statusValue === appt.status) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () {
        updateStatus(appt.id, sel.value);
      });
      return sel;
    }

    function updateStatus(apptId, newStatus) {
      var appts = global.BookEasyStorage.getAppointments();
      var found = false;
      appts = appts.map(function (a) {
        if (a.id !== apptId) return a;
        found = true;
        return Object.assign({}, a, { status: newStatus });
      });
      if (!found) return;
      global.BookEasyStorage.setAppointments(appts);
      renderCurrentView(); // cập nhật ngay UI (badge/màu) + đã persist vào localStorage
    }

    // ---------- Xoá ----------

    function handleDelete(appt) {
      var confirmText = 'Xoá lịch hẹn của khách "' + appt.customerName + '" lúc ' +
        appt.startTime + ' ngày ' + formatDateVN(appt.date) + '? Hành động này không thể hoàn tác.';
      if (!global.confirm(confirmText)) return;

      var next = global.BookEasyStorage.getAppointments().filter(function (a) { return a.id !== appt.id; });
      global.BookEasyStorage.setAppointments(next);
      renderCurrentView();
    }

    // ---------- Sửa: mở modal ----------

    function renderEditServiceOptions(selectedId) {
      var services = global.BookEasyStorage.getServices();
      editServiceSelect.innerHTML = '';
      services.forEach(function (svc) {
        var opt = document.createElement('option');
        opt.value = svc.id;
        var priceText = (svc.price === null || svc.price === undefined || svc.price === '')
          ? ''
          : ' — ' + Number(svc.price).toLocaleString('vi-VN') + ' đ';
        opt.textContent = svc.name + ' (' + svc.durationMinutes + ' phút)' + priceText;
        editServiceSelect.appendChild(opt);
      });
      if (selectedId && services.some(function (s) { return s.id === selectedId; })) {
        editServiceSelect.value = selectedId;
      }
    }

    function renderEditStaffOptions(selectedId) {
      var staff = global.BookEasyStorage.getStaff();
      editStaffSelect.innerHTML = '';
      var anyOpt = document.createElement('option');
      anyOpt.value = '';
      anyOpt.textContent = 'Không yêu cầu / bất kỳ nhân viên nào';
      editStaffSelect.appendChild(anyOpt);
      staff.forEach(function (person) {
        var opt = document.createElement('option');
        opt.value = person.id;
        opt.textContent = person.name;
        editStaffSelect.appendChild(opt);
      });
      editStaffSelect.value = selectedId || '';
    }

    function openEditModal(appt) {
      editIdInput.value = appt.id;
      renderEditServiceOptions(appt.serviceId);
      renderEditStaffOptions(appt.staffId);
      editDateInput.value = appt.date;
      editTimeInput.value = appt.startTime;
      editNameInput.value = appt.customerName;
      editPhoneInput.value = appt.phone;
      editNoteInput.value = appt.note || '';
      setMsg(editMsgEl, '');
      overlay.hidden = false;
      editNameInput.focus();
    }

    function closeEditModal() {
      overlay.hidden = true;
      editForm.reset();
      editIdInput.value = '';
      setMsg(editMsgEl, '');
    }

    editCloseBtn.addEventListener('click', closeEditModal);
    editCancelBtn.addEventListener('click', closeEditModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeEditModal(); // click ra ngoài modal-box để đóng
    });

    editForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var apptId = editIdInput.value;
      var serviceId = editServiceSelect.value;
      var staffId = editStaffSelect.value || null;
      var date = editDateInput.value;
      var time = editTimeInput.value;
      var customerName = editNameInput.value.trim();
      var phoneRaw = editPhoneInput.value.trim();
      var note = editNoteInput.value.trim();

      if (!apptId) { setMsg(editMsgEl, 'Không xác định được lịch hẹn đang sửa.', 'err'); return; }
      if (!serviceId) { setMsg(editMsgEl, 'Vui lòng chọn dịch vụ.', 'err'); return; }
      if (!date) { setMsg(editMsgEl, 'Vui lòng chọn ngày hẹn.', 'err'); return; }
      if (!time) { setMsg(editMsgEl, 'Vui lòng chọn giờ hẹn.', 'err'); return; }
      if (!customerName) { setMsg(editMsgEl, 'Vui lòng nhập tên khách hàng.', 'err'); editNameInput.focus(); return; }
      if (!phoneRaw) { setMsg(editMsgEl, 'Vui lòng nhập số điện thoại.', 'err'); editPhoneInput.focus(); return; }
      if (!isValidVNPhone(phoneRaw)) {
        setMsg(editMsgEl, 'Số điện thoại không hợp lệ (yêu cầu đúng 10 số, bắt đầu bằng số 0).', 'err');
        editPhoneInput.focus();
        return;
      }

      var service = getServiceById(serviceId);
      if (!service) { setMsg(editMsgEl, 'Dịch vụ đã chọn không còn tồn tại, vui lòng chọn lại.', 'err'); renderEditServiceOptions(); return; }

      if (global.BookEasyStorage.wouldCrossMidnight(time, service.durationMinutes)) {
        setMsg(editMsgEl, 'Giờ hẹn + thời lượng dịch vụ ("' + service.name + '", ' + service.durationMinutes +
          ' phút) sẽ vắt qua nửa đêm — vui lòng chọn giờ sớm hơn trong ngày.', 'err');
        return;
      }

      var allAppointments = global.BookEasyStorage.getAppointments();
      var original = allAppointments.filter(function (a) { return a.id === apptId; })[0];
      if (!original) { setMsg(editMsgEl, 'Lịch hẹn không còn tồn tại (có thể đã bị xoá ở nơi khác).', 'err'); return; }

      var candidate = Object.assign({}, original, {
        serviceId: service.id,
        staffId: staffId,
        customerName: customerName,
        phone: phoneRaw,
        note: note,
        date: date,
        startTime: time,
        duration: service.durationMinutes,
        endTime: global.BookEasyStorage.addMinutesToTime(time, service.durationMinutes)
      });

      // HOOK kiểm tra trùng lịch (T4) khi sửa — kích hoạt lại vì giờ/nhân viên
      // (hoặc bất kỳ trường ảnh hưởng nào khác) có thể đã đổi. excludeId = apptId
      // để không tự so sánh lịch hẹn với chính nó.
      var conflictAppt = global.BookEasyStorage.findScheduleConflict(candidate, allAppointments, apptId);
      if (conflictAppt) {
        var conflictStaff = getStaffById(conflictAppt.staffId);
        var conflictStaffName = conflictStaff ? conflictStaff.name : 'nhân viên đã chọn';
        setMsg(editMsgEl, 'Trùng lịch: nhân viên "' + conflictStaffName + '" đã có lịch hẹn từ ' +
          conflictAppt.startTime + ' đến ' + conflictAppt.endTime + ' ngày ' + conflictAppt.date +
          ' (khách "' + conflictAppt.customerName + '"). Vui lòng chọn giờ khác hoặc đổi nhân viên.', 'err');
        return;
      }

      var nextAppointments = allAppointments.map(function (a) { return a.id === apptId ? candidate : a; });
      global.BookEasyStorage.setAppointments(nextAppointments);

      closeEditModal();

      // Nếu sửa sang ngày khác với ngày đang lọc, chuyển bộ lọc sang đúng ngày đó
      // để người dùng thấy ngay kết quả vừa sửa thay vì tưởng lịch hẹn "biến mất".
      if (filterDateInput.value !== date) {
        filterDateInput.value = date;
      }
      renderCurrentView();
    });

    // ---------- Render: chế độ Danh sách (bảng) ----------

    function renderListView() {
      var appts = getAppointmentsForSelectedDate();
      tbody.innerHTML = '';

      appts.forEach(function (appt) {
        var tr = document.createElement('tr');

        var tdTime = document.createElement('td');
        tdTime.textContent = appt.startTime + '–' + appt.endTime;

        var tdName = document.createElement('td');
        tdName.textContent = appt.customerName;

        var tdService = document.createElement('td');
        tdService.textContent = serviceLabel(appt);

        var tdStaff = document.createElement('td');
        tdStaff.textContent = staffLabel(appt);

        var tdPhone = document.createElement('td');
        tdPhone.textContent = appt.phone;

        var tdStatus = document.createElement('td');
        tdStatus.appendChild(buildStatusSelect(appt));

        var tdActions = document.createElement('td');
        tdActions.className = 'actions-cell';

        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-ghost btn-sm';
        editBtn.textContent = 'Sửa';
        editBtn.addEventListener('click', function () { openEditModal(appt); });

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-ghost btn-sm btn-danger';
        delBtn.textContent = 'Xoá';
        delBtn.addEventListener('click', function () { handleDelete(appt); });

        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);

        tr.appendChild(tdTime);
        tr.appendChild(tdName);
        tr.appendChild(tdService);
        tr.appendChild(tdStaff);
        tr.appendChild(tdPhone);
        tr.appendChild(tdStatus);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });

      table.hidden = appts.length === 0;
      dayView.hidden = true;
      emptyNote.hidden = appts.length > 0;
    }

    // ---------- Render: chế độ Lịch ngày (nhóm theo khung giờ) ----------

    function hourBlockLabel(startTime) {
      var minutes = global.BookEasyStorage.timeToMinutes(startTime);
      var hour = Math.floor(minutes / 60);
      var hh = (hour < 10 ? '0' + hour : '' + hour);
      var nextHh = (((hour + 1) % 24) < 10 ? '0' + ((hour + 1) % 24) : '' + ((hour + 1) % 24));
      return hh + ':00 – ' + nextHh + ':00';
    }

    function renderDayViewContent() {
      var appts = getAppointmentsForSelectedDate();
      dayView.innerHTML = '';

      if (!appts.length) {
        table.hidden = true;
        dayView.hidden = true;
        emptyNote.hidden = false;
        return;
      }

      // Nhóm theo khung giờ (mỗi block 1 tiếng), giữ thứ tự tăng dần theo giờ.
      var groups = []; // [{ label, hourKey, items: [] }]
      var groupByHourKey = {};

      appts.forEach(function (appt) {
        var minutes = global.BookEasyStorage.timeToMinutes(appt.startTime);
        var hourKey = Math.floor(minutes / 60);
        if (!groupByHourKey[hourKey]) {
          var group = { hourKey: hourKey, label: hourBlockLabel(appt.startTime), items: [] };
          groupByHourKey[hourKey] = group;
          groups.push(group);
        }
        groupByHourKey[hourKey].items.push(appt);
      });

      groups.sort(function (a, b) { return a.hourKey - b.hourKey; });

      groups.forEach(function (group) {
        var groupEl = document.createElement('div');
        groupEl.className = 'appt-hour-group';

        var headEl = document.createElement('div');
        headEl.className = 'appt-hour-group-head';
        headEl.textContent = group.label;
        groupEl.appendChild(headEl);

        group.items.forEach(function (appt) {
          var cardEl = document.createElement('div');
          cardEl.className = 'appt-card';

          var infoEl = document.createElement('div');
          infoEl.className = 'appt-card-info';

          var timeEl = document.createElement('div');
          timeEl.className = 'appt-card-time';
          timeEl.textContent = appt.startTime + '–' + appt.endTime + ' · ' + appt.customerName;
          infoEl.appendChild(timeEl);

          var serviceEl = document.createElement('div');
          serviceEl.className = 'appt-card-service';
          serviceEl.textContent = serviceLabel(appt) + ' · ' + staffLabel(appt) + ' · ' + appt.phone;
          infoEl.appendChild(serviceEl);

          var actionsEl = document.createElement('div');
          actionsEl.className = 'appt-card-actions';

          actionsEl.appendChild(buildStatusSelect(appt));

          var editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'btn btn-ghost btn-sm';
          editBtn.textContent = 'Sửa';
          editBtn.addEventListener('click', function () { openEditModal(appt); });
          actionsEl.appendChild(editBtn);

          var delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn btn-ghost btn-sm btn-danger';
          delBtn.textContent = 'Xoá';
          delBtn.addEventListener('click', function () { handleDelete(appt); });
          actionsEl.appendChild(delBtn);

          cardEl.appendChild(infoEl);
          cardEl.appendChild(actionsEl);
          groupEl.appendChild(cardEl);
        });

        dayView.appendChild(groupEl);
      });

      table.hidden = true;
      dayView.hidden = false;
      emptyNote.hidden = true;
    }

    // ---------- Chuyển đổi chế độ xem ----------

    function renderCurrentView() {
      if (viewMode === 'day') {
        renderDayViewContent();
      } else {
        renderListView();
      }
    }

    function setViewMode(mode) {
      viewMode = mode;
      viewListBtn.classList.toggle('active', mode === 'list');
      viewDayBtn.classList.toggle('active', mode === 'day');
      renderCurrentView();
    }

    viewListBtn.addEventListener('click', function () { setViewMode('list'); });
    viewDayBtn.addEventListener('click', function () { setViewMode('day'); });

    filterDateInput.addEventListener('change', renderCurrentView);
    todayBtn.addEventListener('click', function () {
      filterDateInput.value = todayISODate();
      renderCurrentView();
    });

    // Nạp lại danh sách mỗi khi người dùng quay vào tab "Quản trị" — đảm bảo
    // phản ánh đúng lịch hẹn vừa đặt ở khu vực "Đặt lịch" (T3) hoặc thay đổi
    // dịch vụ/nhân viên vừa cấu hình.
    document.querySelectorAll('#mainNav .nav-btn[data-view="admin"]').forEach(function (btn) {
      btn.addEventListener('click', renderCurrentView);
    });

    renderCurrentView();
  }

})(window);

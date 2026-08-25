/* ============================================================
 * BookEasy — admin-config.js
 * CRUD cấu hình Dịch vụ & Nhân viên (khu vực Quản trị)
 * Đọc/ghi dữ liệu qua js/storage.js (BookEasyStorage) — không tự
 * quản lý localStorage trực tiếp ở file này.
 *
 * Là input bắt buộc cho form đặt lịch (chọn dịch vụ 'cấu hình được').
 * ============================================================ */

(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!global.BookEasyStorage) {
      console.error('[BookEasy admin-config] BookEasyStorage chưa được nạp (thiếu js/storage.js?).');
      return;
    }
    initServiceConfig();
    initStaffConfig();
  });

  // ---------- Tiện ích dùng chung ----------

  function formatPrice(price) {
    if (price === null || price === undefined || price === '') return '—'; // —
    var n = Number(price);
    if (isNaN(n)) return '—';
    return n.toLocaleString('vi-VN') + ' đ';
  }

  function countActiveAppointmentsBy(field, id) {
    var appts = global.BookEasyStorage.getAppointments();
    return appts.filter(function (a) {
      return a[field] === id && a.status !== global.BookEasyStorage.STATUS.CANCELLED;
    }).length;
  }

  function setMsg(el, text, kind) {
    el.textContent = text || '';
    el.className = 'form-msg' + (kind ? ' form-msg-' + kind : '');
  }

  // ---------- Cấu hình Dịch vụ ----------

  function initServiceConfig() {
    var form = document.getElementById('serviceForm');
    if (!form) return;

    var nameInput = document.getElementById('serviceName');
    var durationInput = document.getElementById('serviceDuration');
    var priceInput = document.getElementById('servicePrice');
    var editIdInput = document.getElementById('serviceEditId');
    var submitBtn = document.getElementById('serviceSubmitBtn');
    var cancelBtn = document.getElementById('serviceCancelBtn');
    var msgEl = document.getElementById('serviceFormMsg');
    var table = document.getElementById('serviceTable');
    var tbody = document.getElementById('serviceTableBody');
    var emptyNote = document.getElementById('serviceEmptyNote');

    function resetForm() {
      form.reset();
      editIdInput.value = '';
      submitBtn.textContent = 'Thêm dịch vụ';
      cancelBtn.hidden = true;
    }

    function startEdit(svc) {
      editIdInput.value = svc.id;
      nameInput.value = svc.name;
      durationInput.value = svc.durationMinutes;
      priceInput.value = (svc.price === null || svc.price === undefined) ? '' : svc.price;
      submitBtn.textContent = 'Lưu thay đổi';
      cancelBtn.hidden = false;
      setMsg(msgEl, '');
      nameInput.focus();
    }

    function renderList() {
      var services = global.BookEasyStorage.getServices();
      tbody.innerHTML = '';

      if (!services.length) {
        table.hidden = true;
        emptyNote.hidden = false;
        return;
      }
      table.hidden = false;
      emptyNote.hidden = true;

      services.forEach(function (svc) {
        var tr = document.createElement('tr');

        var tdName = document.createElement('td');
        tdName.textContent = svc.name;

        var tdDuration = document.createElement('td');
        tdDuration.textContent = svc.durationMinutes + ' phút';

        var tdPrice = document.createElement('td');
        tdPrice.textContent = formatPrice(svc.price);

        var tdActions = document.createElement('td');
        tdActions.className = 'actions-cell';

        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-ghost btn-sm';
        editBtn.textContent = 'Sửa';
        editBtn.addEventListener('click', function () { startEdit(svc); });

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-ghost btn-sm btn-danger';
        delBtn.textContent = 'Xoá';
        delBtn.addEventListener('click', function () { handleDelete(svc); });

        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);

        tr.appendChild(tdName);
        tr.appendChild(tdDuration);
        tr.appendChild(tdPrice);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }

    function handleDelete(svc) {
      var usedCount = countActiveAppointmentsBy('serviceId', svc.id);
      var confirmText = 'Xoá dịch vụ "' + svc.name + '"?';
      if (usedCount > 0) {
        confirmText = 'Dịch vụ "' + svc.name + '" đang được dùng trong ' + usedCount +
          ' lịch hẹn chưa huỷ. Xoá dịch vụ sẽ KHÔNG xoá các lịch hẹn đó, nhưng dịch vụ ' +
          'sẽ không còn xuất hiện trong danh sách chọn khi đặt lịch mới. Vẫn xoá?';
      }
      if (!global.confirm(confirmText)) return;

      var next = global.BookEasyStorage.getServices().filter(function (s) { return s.id !== svc.id; });
      global.BookEasyStorage.setServices(next);

      if (editIdInput.value === svc.id) resetForm();
      setMsg(msgEl, 'Đã xoá dịch vụ "' + svc.name + '".', 'ok');
      renderList();
    }

    cancelBtn.addEventListener('click', function () {
      resetForm();
      setMsg(msgEl, '');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = nameInput.value.trim();
      var duration = parseInt(durationInput.value, 10);
      var priceRaw = priceInput.value.trim();
      var price = priceRaw === '' ? null : Number(priceRaw);
      var editId = editIdInput.value;

      if (!name) { setMsg(msgEl, 'Vui lòng nhập tên dịch vụ.', 'err'); return; }
      if (!duration || duration <= 0) { setMsg(msgEl, 'Thời lượng phải là số phút lớn hơn 0.', 'err'); return; }
      if (priceRaw !== '' && (isNaN(price) || price < 0)) { setMsg(msgEl, 'Giá không hợp lệ.', 'err'); return; }

      var services = global.BookEasyStorage.getServices();
      var isDup = services.some(function (s) {
        return s.id !== editId && s.name.trim().toLowerCase() === name.toLowerCase();
      });
      if (isDup) { setMsg(msgEl, 'Đã có dịch vụ khác trùng tên này.', 'err'); return; }

      if (editId) {
        services = services.map(function (s) {
          if (s.id !== editId) return s;
          return { id: s.id, name: name, durationMinutes: duration, price: price };
        });
        global.BookEasyStorage.setServices(services);
        setMsg(msgEl, 'Đã lưu thay đổi dịch vụ "' + name + '".', 'ok');
      } else {
        var newSvc = {
          id: global.BookEasyStorage.generateId('svc'),
          name: name,
          durationMinutes: duration,
          price: price
        };
        services.push(newSvc);
        global.BookEasyStorage.setServices(services);
        setMsg(msgEl, 'Đã thêm dịch vụ "' + name + '".', 'ok');
      }

      var savedMsg = msgEl.textContent;
      var savedClass = msgEl.className;
      resetForm();
      msgEl.textContent = savedMsg;
      msgEl.className = savedClass;

      renderList();
    });

    renderList();
  }

  // ---------- Cấu hình Nhân viên ----------

  function initStaffConfig() {
    var form = document.getElementById('staffForm');
    if (!form) return;

    var nameInput = document.getElementById('staffName');
    var editIdInput = document.getElementById('staffEditId');
    var submitBtn = document.getElementById('staffSubmitBtn');
    var cancelBtn = document.getElementById('staffCancelBtn');
    var msgEl = document.getElementById('staffFormMsg');
    var table = document.getElementById('staffTable');
    var tbody = document.getElementById('staffTableBody');
    var emptyNote = document.getElementById('staffEmptyNote');

    function resetForm() {
      form.reset();
      editIdInput.value = '';
      submitBtn.textContent = 'Thêm nhân viên';
      cancelBtn.hidden = true;
    }

    function startEdit(person) {
      editIdInput.value = person.id;
      nameInput.value = person.name;
      submitBtn.textContent = 'Lưu thay đổi';
      cancelBtn.hidden = false;
      setMsg(msgEl, '');
      nameInput.focus();
    }

    function renderList() {
      var staff = global.BookEasyStorage.getStaff();
      tbody.innerHTML = '';

      if (!staff.length) {
        table.hidden = true;
        emptyNote.hidden = false;
        return;
      }
      table.hidden = false;
      emptyNote.hidden = true;

      staff.forEach(function (person) {
        var tr = document.createElement('tr');

        var tdName = document.createElement('td');
        tdName.textContent = person.name;

        var tdActions = document.createElement('td');
        tdActions.className = 'actions-cell';

        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-ghost btn-sm';
        editBtn.textContent = 'Sửa';
        editBtn.addEventListener('click', function () { startEdit(person); });

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-ghost btn-sm btn-danger';
        delBtn.textContent = 'Xoá';
        delBtn.addEventListener('click', function () { handleDelete(person); });

        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);

        tr.appendChild(tdName);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }

    function handleDelete(person) {
      var usedCount = countActiveAppointmentsBy('staffId', person.id);
      var confirmText = 'Xoá nhân viên "' + person.name + '"?';
      if (usedCount > 0) {
        confirmText = 'Nhân viên "' + person.name + '" đang được phân công trong ' + usedCount +
          ' lịch hẹn chưa huỷ. Xoá nhân viên sẽ KHÔNG xoá các lịch hẹn đó, nhưng nhân viên ' +
          'sẽ không còn xuất hiện trong danh sách chọn khi đặt lịch mới. Vẫn xoá?';
      }
      if (!global.confirm(confirmText)) return;

      var next = global.BookEasyStorage.getStaff().filter(function (s) { return s.id !== person.id; });
      global.BookEasyStorage.setStaff(next);

      if (editIdInput.value === person.id) resetForm();
      setMsg(msgEl, 'Đã xoá nhân viên "' + person.name + '".', 'ok');
      renderList();
    }

    cancelBtn.addEventListener('click', function () {
      resetForm();
      setMsg(msgEl, '');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = nameInput.value.trim();
      var editId = editIdInput.value;

      if (!name) { setMsg(msgEl, 'Vui lòng nhập tên nhân viên.', 'err'); return; }

      var staff = global.BookEasyStorage.getStaff();
      var isDup = staff.some(function (s) {
        return s.id !== editId && s.name.trim().toLowerCase() === name.toLowerCase();
      });
      if (isDup) { setMsg(msgEl, 'Đã có nhân viên khác trùng tên này.', 'err'); return; }

      if (editId) {
        staff = staff.map(function (s) {
          if (s.id !== editId) return s;
          return { id: s.id, name: name };
        });
        global.BookEasyStorage.setStaff(staff);
        setMsg(msgEl, 'Đã lưu thay đổi nhân viên "' + name + '".', 'ok');
      } else {
        var newPerson = { id: global.BookEasyStorage.generateId('staff'), name: name };
        staff.push(newPerson);
        global.BookEasyStorage.setStaff(staff);
        setMsg(msgEl, 'Đã thêm nhân viên "' + name + '".', 'ok');
      }

      var savedMsg = msgEl.textContent;
      var savedClass = msgEl.className;
      resetForm();
      msgEl.textContent = savedMsg;
      msgEl.className = savedClass;

      renderList();
    });

    renderList();
  }

})(window);

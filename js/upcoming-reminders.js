/* ============================================================
 * BookEasy — upcoming-reminders.js
 * Khối "Lịch hẹn sắp tới" / nhắc lịch NỘI BỘ trong giao diện.
 *
 * PHẠM VI (đã thống nhất ở research/planning): chỉ hiển thị badge +
 * danh sách "Lịch hẹn hôm nay" (status='confirmed', còn lại — chưa kết
 * thúc) ngay trong header, dùng chung cho mọi khu vực (Đặt lịch/Quản
 * trị) vì header luôn hiển thị. KHÔNG gửi SMS/Email/Zalo thật — kiến
 * trúc app này là client-side thuần/no-backend nên không khả thi, và
 * việc đó KHÔNG được claim ở bất kỳ đâu trong UI (xem footnote trong
 * index.html: "Nhắc lịch nội bộ trong ứng dụng — không gửi SMS/Email/
 * Zalo."). Trình duyệt Notification API là stretch goal, KHÔNG bắt
 * buộc — không triển khai ở bản này để giữ đúng phạm vi tối thiểu.
 *
 * Đọc dữ liệu qua js/storage.js (BookEasyStorage) — không tự quản lý
 * localStorage trực tiếp ở file này.
 *
 * Cập nhật danh sách khi có thay đổi:
 *  - Sự kiện 'bookeasy:appointments-changed' do BookEasyStorage.setAppointments()
 *    phát ra (storage.js) — bắt được MỌI thay đổi (thêm ở booking-form.js,
 *    sửa/xoá/đổi trạng thái ở admin-appointments.js) mà không cần sửa
 *    từng nơi gọi.
 *  - setInterval mỗi 30 giây để phản ánh đúng theo thời gian thực tế
 *    trôi qua (lịch hẹn tự "rớt khỏi" danh sách khi đã kết thúc, hoặc
 *    chuyển sang nhóm "sắp tới trong 1 giờ" khi gần tới giờ).
 * ============================================================ */

(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!global.BookEasyStorage) {
      console.error('[BookEasy upcoming-reminders] BookEasyStorage chưa được nạp (thiếu js/storage.js?).');
      return;
    }
    initReminderWidget();
  });

  var SOON_THRESHOLD_MINUTES = 60; // "trong 1 giờ tới"
  var REFRESH_INTERVAL_MS = 30000; // 30 giây — cập nhật theo thời gian trôi qua

  function todayISODate() {
    var d = new Date();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function nowMinutes() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function initReminderWidget() {
    var badgeBtn = document.getElementById('reminderBadgeBtn');
    var badgeCount = document.getElementById('reminderBadgeCount');
    var panel = document.getElementById('reminderPanel');
    var panelList = document.getElementById('reminderPanelList');
    var panelEmpty = document.getElementById('reminderPanelEmpty');

    if (!badgeBtn || !panel || !panelList) return; // khối chưa có trong DOM (an toàn nếu HTML thay đổi)

    function getServiceById(id) {
      return global.BookEasyStorage.getServices().filter(function (s) { return s.id === id; })[0] || null;
    }

    function serviceLabel(appt) {
      var svc = getServiceById(appt.serviceId);
      return svc ? svc.name : '(dịch vụ đã bị xoá)';
    }

    // "Còn lại hôm nay" = ngày = hôm nay, status = confirmed, CHƯA kết thúc
    // (endTime > giờ hiện tại) — lịch đã qua giờ kết thúc không còn tính là
    // "còn lại" nữa dù trạng thái vẫn để confirmed (lễ tân quên đổi trạng thái).
    function getRemainingTodayConfirmed() {
      var today = todayISODate();
      var nowMin = nowMinutes();
      var appts = global.BookEasyStorage.getAppointments().filter(function (a) {
        if (a.date !== today) return false;
        if (a.status !== global.BookEasyStorage.STATUS.CONFIRMED) return false;
        return global.BookEasyStorage.timeToMinutes(a.endTime) > nowMin;
      });
      appts.sort(function (a, b) {
        return global.BookEasyStorage.timeToMinutes(a.startTime) - global.BookEasyStorage.timeToMinutes(b.startTime);
      });
      return appts;
    }

    function render() {
      var appts = getRemainingTodayConfirmed();
      var nowMin = nowMinutes();

      badgeCount.textContent = String(appts.length);
      badgeBtn.classList.toggle('has-soon', appts.some(function (a) {
        var startMin = global.BookEasyStorage.timeToMinutes(a.startTime);
        return startMin - nowMin <= SOON_THRESHOLD_MINUTES && startMin - nowMin >= 0;
      }));

      panelList.innerHTML = '';

      if (!appts.length) {
        panelEmpty.hidden = false;
        return;
      }
      panelEmpty.hidden = true;

      appts.forEach(function (appt) {
        var startMin = global.BookEasyStorage.timeToMinutes(appt.startTime);
        var isSoon = (startMin - nowMin) <= SOON_THRESHOLD_MINUTES && (startMin - nowMin) >= 0;

        var itemEl = document.createElement('div');
        itemEl.className = 'reminder-item' + (isSoon ? ' reminder-item-soon' : '');

        var timeEl = document.createElement('div');
        timeEl.className = 'reminder-item-time';
        timeEl.textContent = appt.startTime + '–' + appt.endTime;
        itemEl.appendChild(timeEl);

        var infoEl = document.createElement('div');
        infoEl.className = 'reminder-item-info';
        infoEl.textContent = appt.customerName + ' · ' + serviceLabel(appt);
        itemEl.appendChild(infoEl);

        if (isSoon) {
          var soonTag = document.createElement('span');
          soonTag.className = 'reminder-item-soon-tag';
          soonTag.textContent = 'Trong 1 giờ tới';
          itemEl.appendChild(soonTag);
        }

        panelList.appendChild(itemEl);
      });
    }

    // ---------- Mở/đóng panel ----------

    function openPanel() {
      panel.hidden = false;
      badgeBtn.setAttribute('aria-expanded', 'true');
    }

    function closePanel() {
      panel.hidden = true;
      badgeBtn.setAttribute('aria-expanded', 'false');
    }

    badgeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.hidden) {
        render(); // đảm bảo danh sách mới nhất ngay lúc mở
        openPanel();
      } else {
        closePanel();
      }
    });

    document.addEventListener('click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== badgeBtn) {
        closePanel();
      }
    });

    // ---------- Cập nhật khi dữ liệu thay đổi (thêm/sửa/xoá/đổi trạng thái) ----------

    global.addEventListener('bookeasy:appointments-changed', render);

    // ---------- Cập nhật định kỳ theo thời gian thực trôi qua ----------

    global.setInterval(render, REFRESH_INTERVAL_MS);

    render();
  }

})(window);

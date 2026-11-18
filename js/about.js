/* =========================================================
   about.js – TRANG GIỚI THIỆU (jQuery)
   Tính số liệu thống kê từ dữ liệu thật (giống home.js) và chạy
   hiệu ứng đếm số khi cuộn tới. Nếu không tải được dữ liệu thì
   giữ nguyên số dự phòng đã viết sẵn trong about.html.
   Phụ thuộc: jQuery, data.js, main.js
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data;

  function setStat(id, n) {
    var $el = $(id);
    $el.attr('data-count', n).text(n);
  }

  function animateCount(el) {
    var end = +el.getAttribute('data-count');
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = end; return; }
    var t0 = global.performance.now(), dur = 1200;
    function tick(t) {
      var p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) { global.requestAnimationFrame(tick); }
    }
    global.requestAnimationFrame(tick);
  }

  function observeCounters() {
    var els = document.querySelectorAll('[data-count]');
    if (!('IntersectionObserver' in global)) { return; } // giữ nguyên số tĩnh
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        animateCount(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  function init() {
    D.loadContext().then(function (ctx) {
      var former = 0, places = 0, specs = 0;
      ctx.units.forEach(function (u) {
        former += u.formerUnits.length;
        places += u.searchNames.destinations.length;
        specs += u.searchNames.specialties.length;
      });
      setStat('#ab-stat-units', ctx.units.length);
      setStat('#ab-stat-former', former);
      setStat('#ab-stat-places', places);
      setStat('#ab-stat-specs', specs);
    }).catch(function () {
      /* không tải được dữ liệu: dùng số dự phòng trong HTML */
    }).then(observeCounters);
  }

  $(init);
})(window, jQuery);

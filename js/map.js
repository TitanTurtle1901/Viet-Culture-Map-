/* =========================================================
   map.js – BẢN ĐỒ TƯƠNG TÁC (jQuery + SVG)
   Hover/Click/Touch, popup thông tin nhanh, lọc theo miền,
   phóng to – thu nhỏ – kéo, nhãn theo mức zoom, danh sách địa phương.
   Phụ thuộc: jQuery, data.js, main.js
   Ghi chú: chỉ sự kiện `wheel` dùng addEventListener gốc ({passive:false})
   vì jQuery không cho đặt passive:false; mọi sự kiện khác dùng jQuery.
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data, U = global.VCM.ui, esc = D.escapeHtml;
  var NS = 'http://www.w3.org/2000/svg';
  var MAX_ZOOM = 6;
  var SHOW_DELAY = 70, HIDE_DELAY = 220;
  var ISLAND_INFO = {
    'hoang-sa': {
      name: 'Quần đảo Hoàng Sa',
      description: 'Quần đảo gồm các đảo, đá, bãi cạn và rạn san hô trên Biển Đông.',
      details: [
        { label: 'Vị trí', value: 'Phía đông Việt Nam, ngoài khơi miền Trung.' },
        { label: 'Đơn vị hành chính', value: 'Đặc khu Hoàng Sa, thành phố Đà Nẵng.' },
        { label: 'Địa hình', value: 'Các nhóm đảo, bãi đá và rạn san hô; những đảo tiêu biểu gồm Phú Lâm, Hoàng Sa, Hữu Nhật, Quang Ảnh và Tri Tôn.' },
        { label: 'Giá trị văn hóa', value: 'Gắn với lịch sử đội Hoàng Sa và Lễ Khao lề thế lính Hoàng Sa được gìn giữ tại Lý Sơn.' }
      ]
    },
    'truong-sa': {
      name: 'Quần đảo Trường Sa',
      description: 'Quần đảo gồm các đảo, đá, bãi cạn và rạn san hô trên Biển Đông.',
      details: [
        { label: 'Vị trí', value: 'Phía nam Biển Đông, ngoài khơi Nam Trung Bộ.' },
        { label: 'Đơn vị hành chính', value: 'Đặc khu Trường Sa, tỉnh Khánh Hòa.' },
        { label: 'Địa hình', value: 'Các đảo nổi, bãi đá và rạn san hô phân bố trên vùng biển rộng; những đảo tiêu biểu gồm Trường Sa Lớn, Song Tử Tây, Nam Yết, Sinh Tồn và Sơn Ca.' },
        { label: 'Đời sống', value: 'Đời sống trên đảo gắn với biển, hoạt động của cư dân và nhiệm vụ bảo vệ chủ quyền biển đảo.' }
      ]
    }
  };
  var ALWAYS_VISIBLE_PROVINCES = {
    'ha-noi': true,
    'hai-phong': true,
    'hue': true,
    'da-nang': true,
    'ho-chi-minh': true,
    'can-tho': true
  };
  var CITY_LABEL_OFFSETS = {
    'ha-noi': { x: -5, y: -8 },
    'hai-phong': { x: 5, y: 8 }
  };

  var ctx = null, svgEl = null, $svg = null, vb0 = null, view = null;
  var labelLeaderLayer = null;
  var activeId = null, popupId = null, pinned = false;
  var showTimer = null, hideTimer = null, popupHovered = false;
  var lastPointer = 'mouse';                 // 'mouse' | 'touch' | 'pen'
  var pointers = {}, pinchPrev = 0, dragStart = null, moved = false, suppressClick = false;

  /* ---------- Khởi tạo ---------- */
  function init() {
    if (!$('#map-container').length) { return; }
    Promise.all([D.loadContext(), fetch(D.PATHS.mapSvg).then(function (r) {
      if (!r.ok) { throw new Error('Không tải được bản đồ SVG'); }
      return r.text();
    })]).then(function (res) {
      ctx = res[0];
      mountMap(res[1]);
      buildPanel();
      bindMapEvents();
      bindPopupEvents();
    }).catch(function (err) {
      $('#map-container').html('<div class="p-8 text-center text-crimson-700" role="alert" style="line-height:1.6">' +
        '<p class="font-semibold">Không thể tải bản đồ.</p>' +
        '<p class="text-sm mt-1">Hãy mở dự án bằng máy chủ cục bộ (ví dụ VS Code Live Server) thay vì mở trực tiếp file HTML. Chi tiết: ' + esc(err.message) + '</p></div>');
      $('#province-list').text('');
    });
  }

  function mountMap(svgText) {
    $('#map-container').html(svgText);
    $svg = $('#vietnam-map');
    svgEl = $svg[0];
    var mapDescription = svgEl.querySelector('#map-desc');
    if (mapDescription) {
      mapDescription.textContent = 'Ranh giới 34 tỉnh/thành phố từ GeoJSON của Free-GIS-Data (nguyenduy1133), đã làm mịn đường biên. Tên sáu thành phố trực thuộc Trung ương luôn hiển thị; tên tỉnh khác xuất hiện khi được trỏ hoặc chọn. Dấu sao chỉ vị trí thủ đô Hà Nội. Hoàng Sa và Trường Sa được thể hiện riêng, không theo vị trí và tỷ lệ thật.';
    }
    var p = svgEl.getAttribute('viewBox').split(/\s+/).map(Number);
    vb0 = { x: p[0], y: p[1], w: p[2], h: p[3] };
    view = $.extend({}, vb0);

    // Gắn lớp vùng miền + khả năng tiếp cận bàn phím; kiểm tra khớp 34 id với dữ liệu
    var found = {};
    $svg.find('.province').each(function () {
      var id = $(this).attr('data-province-id');
      var islandId = $(this).attr('data-island-id');
      var u = ctx.byId[id];
      if (!u) { console.error('[map] SVG có id không có trong dữ liệu:', id); return; }
      found[id] = true;
      $(this).addClass('region-' + u.macro).attr({
        tabindex: islandId ? -1 : 0,
        role: islandId ? 'button' : 'link',
        'aria-label': islandId && ISLAND_INFO[islandId] ? ISLAND_INFO[islandId].name + ' – xem thông tin' : u.name + ' – xem thông tin'
      });
    });
    $svg.find('.province-hit').each(function () {
      var island = ISLAND_INFO[$(this).attr('data-island-id')];
      if (!island) { return; }
      $(this).attr({ tabindex: 0, role: 'button', 'aria-label': island.name + ' – xem thông tin' });
    });
    ctx.units.forEach(function (u) { if (!found[u.id]) { console.error('[map] Thiếu địa phương trên SVG:', u.id); } });

    // Lớp làm nổi bật (clone đường biên để không đổi thứ tự DOM dưới con trỏ)
    var layer = document.createElementNS(NS, 'g');
    layer.setAttribute('id', 'highlight-layer');
    layer.setAttribute('pointer-events', 'none');
    svgEl.insertBefore(layer, svgEl.querySelector('#labels'));

    labelLeaderLayer = document.createElementNS(NS, 'g');
    labelLeaderLayer.setAttribute('id', 'label-leaders');
    labelLeaderLayer.setAttribute('pointer-events', 'none');
    svgEl.insertBefore(labelLeaderLayer, svgEl.querySelector('#labels'));

    updateLabels();
  }

  /* ---------- Làm nổi bật ---------- */
  function setActive(id) {
    if (activeId === id) { return; }
    clearActive();
    activeId = id;
    var layer = svgEl.querySelector('#highlight-layer');
    $svg.find('.province[data-province-id="' + id + '"]').each(function () {
      var c = document.createElementNS(NS, 'path');
      c.setAttribute('d', this.getAttribute('d'));
      c.setAttribute('class', 'province-highlight');
      layer.appendChild(c);
    });
    $svg.find('.province-label[data-for="' + id + '"]').addClass('is-active').removeClass('is-hidden');
    $('.province-list-btn[data-province-id="' + id + '"]').addClass('is-active');
  }

  function clearActive() {
    if (!activeId) { return; }
    $(svgEl).find('#highlight-layer').empty();
    $svg.find('.province-label.is-active').removeClass('is-active');
    $('.province-list-btn.is-active').removeClass('is-active');
    activeId = null;
    updateLabels();
  }

  /* ---------- Popup thông tin nhanh ---------- */
  function popupHtml(u) {
    if (typeof u === 'string') {
      var island = ISLAND_INFO[u];
      return '' +
        '<div class="relative">' +
          '<button type="button" class="popup-close" aria-label="Đóng thông tin">&times;</button></div>' +
        '<div class="p-4">' +
          '<h3 class="font-display text-lg font-bold text-deep-700 leading-snug pr-8">' + esc(island.name) + '</h3>' +
          '<p class="text-sm text-gray-700 mt-2">' + esc(island.description) + '</p>' +
          '<dl class="island-details text-sm mt-3">' +
            island.details.map(function (item) {
              return '<div><dt class="font-semibold text-forest-700">' + esc(item.label) + '</dt><dd class="text-gray-700 mt-0.5">' + esc(item.value) + '</dd></div>';
            }).join('') +
          '</dl>' +
        '</div>';
    }
    var s = u.summary;
    var dests = s.featuredDestinations.slice(0, 2).map(function (x) { return esc(x.name); }).join(', ');
    var specs = s.featuredSpecialties.slice(0, 2).map(function (x) { return esc(x.name); }).join(', ');
    return '' +
      '<div class="relative">' + U.provinceThumb(u, 'popup-thumb') +
        '<button type="button" class="popup-close" aria-label="Đóng thông tin">&times;</button></div>' +
      '<div class="p-4">' +
        '<div class="flex items-center gap-2 flex-wrap mb-1">' + U.macroBadge(ctx, u.macro) +
          '<span class="text-xs text-gray-500">' + esc(u.administrativeType) + '</span></div>' +
        '<h3 class="font-display text-lg font-bold text-deep-700 leading-snug">' + esc(u.name) + '</h3>' +
        '<p class="text-sm text-gray-700 mt-1 line-clamp-3">' + esc(D.firstSentences(s.shortIntroduction, 2)) + '</p>' +
        '<dl class="text-sm mt-2 space-y-1">' +
          (dests ? '<div><dt class="inline font-semibold text-forest-700">Địa điểm:</dt> <dd class="inline">' + dests + '</dd></div>' : '') +
          (specs ? '<div><dt class="inline font-semibold text-ochre-600">Đặc sản:</dt> <dd class="inline">' + specs + '</dd></div>' : '') +
        '</dl>' +
        '<a class="btn-forest w-full justify-center mt-3" href="' + D.detailUrl(u.id) + '">Xem chi tiết ' + U.ICON.arrow + '</a>' +
      '</div>';
  }

  function placePopup($p, x, y) {
    var vw = $(global).width(), vh = $(global).height(), m = 8;
    var w = $p.outerWidth(), h = $p.outerHeight();
    var left = x + 12, top = y + 8;
    if (left + w > vw - m) { left = x - w - 12; }
    if (left < m) { left = Math.max(m, vw - w - m); }
    if (top + h > vh - m) { top = y - h - 8; }
    if (top < m) { top = m; }
    $p.css({ left: left + 'px', top: top + 'px' });
  }

  function showPopup(id, x, y, isPinned) {
    var islandId = id.indexOf('island:') === 0 ? id.slice(7) : null;
    var u = islandId ? ISLAND_INFO[islandId] : ctx.byId[id];
    if (!u) { return; }
    var $p = $('#province-popup');
    clearTimeout(hideTimer);
    if (popupId !== id) {
      $p.html(popupHtml(islandId || u));
      U.hydrateSilhouettes($p);
    }
    popupId = id;
    pinned = !!isPinned;
    $p.toggleClass('is-pinned', pinned).attr('aria-hidden', 'false');
    placePopup($p, x, y);
    $p.addClass('is-visible');
    if (islandId) { clearActive(); }
    else { setActive(id); }
  }

  function hidePopup() {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    $('#province-popup').removeClass('is-visible is-pinned').attr('aria-hidden', 'true');
    popupId = null; pinned = false; popupHovered = false;
    clearActive();
  }

  function scheduleHide(delay) {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (pinned) { return; }
    hideTimer = setTimeout(function () { if (!popupHovered) { hidePopup(); } }, delay == null ? HIDE_DELAY : delay);
  }

  function provinceIdOf(el) { return $(el).attr('data-province-id'); }
  function popupIdOf(el) {
    var islandId = $(el).attr('data-island-id');
    return islandId ? 'island:' + islandId : provinceIdOf(el);
  }

  /* ---------- Sự kiện bản đồ ---------- */
  function bindMapEvents() {
    var SEL = '#map-container .province, #map-container .province-hit';

    // Ghi nhận loại con trỏ để phân biệt chuột và cảm ứng
    $(document).on('pointerdown', '#map-container svg', function (e) {
      var oe = e.originalEvent;
      lastPointer = oe.pointerType || 'mouse';
      pointers[oe.pointerId] = { x: oe.clientX, y: oe.clientY };
      var n = Object.keys(pointers).length;
      if (n === 1) { dragStart = { x: oe.clientX, y: oe.clientY, vx: view.x, vy: view.y }; moved = false; }
      if (n === 2) { pinchPrev = pinchDistance(); moved = true; }
    });

    $(document).on('pointermove', function (e) {
      var oe = e.originalEvent;
      if (!pointers[oe.pointerId]) { return; }
      pointers[oe.pointerId] = { x: oe.clientX, y: oe.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {            // chụm hai ngón
        var d = pinchDistance();
        if (pinchPrev > 0) {
          var mid = pinchMid();
          var c = toSvg(mid.x, mid.y);
          zoomBy(d / pinchPrev, c.x, c.y);
        }
        pinchPrev = d;
        return;
      }
      if (!dragStart) { return; }
      var dx = oe.clientX - dragStart.x, dy = oe.clientY - dragStart.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 5 && zoomLevel() > 1.02) { moved = true; $svg.addClass('is-dragging'); hidePopup(); }
      if (moved && zoomLevel() > 1.02) {
        var k = 1 / svgEl.getScreenCTM().a;
        setView({ x: dragStart.vx - dx * k, y: dragStart.vy - dy * k, w: view.w, h: view.h });
      }
    });

    $(document).on('pointerup pointercancel', function (e) {
      var oe = e.originalEvent;
      if (!pointers[oe.pointerId]) { return; }
      delete pointers[oe.pointerId];
      pinchPrev = 0;
      if (moved) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 0); }
      if (!Object.keys(pointers).length) { dragStart = null; moved = false; $svg.removeClass('is-dragging'); }
    });

    // HOVER (chuột) – cấp độ 1
    $(document).on('mouseenter', SEL, function (e) {
      if (lastPointer === 'touch' || moved) { return; }
      var id = popupIdOf(this), x = e.clientX, y = e.clientY;
      clearTimeout(hideTimer); clearTimeout(showTimer);
      if (popupId === id) { return; }
      showTimer = setTimeout(function () { showPopup(id, x, y, false); }, SHOW_DELAY);
    });
    $(document).on('mouseleave', SEL, function () {
      if (lastPointer === 'touch') { return; }
      scheduleHide();
    });

    // CLICK – cấp độ 2 (chuột: sang trang chi tiết; cảm ứng: mở popup có nút “Xem chi tiết”)
    $(document).on('click', SEL, function (e) {
      if (suppressClick) { e.preventDefault(); return; }
      var id = popupIdOf(this);
      if (lastPointer === 'touch' || id.indexOf('island:') === 0) {
        showPopup(id, e.clientX, e.clientY, true);
        return;
      }
      global.location.href = D.detailUrl(id);
    });

    // Bàn phím
    $(document).on('focus', '#map-container .province, #map-container .province-hit', function () {
      var r = this.getBoundingClientRect();
      showPopup(popupIdOf(this), r.left + r.width / 2, r.top + r.height / 2, false);
    });
    $(document).on('blur', '#map-container .province, #map-container .province-hit', function () { scheduleHide(); });
    $(document).on('keydown', '#map-container .province, #map-container .province-hit', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var id = popupIdOf(this);
        if (id.indexOf('island:') === 0) {
          var r = this.getBoundingClientRect();
          showPopup(id, r.left + r.width / 2, r.top + r.height / 2, true);
        } else {
          global.location.href = D.detailUrl(id);
        }
      }
      if (e.key === 'Escape') { hidePopup(); }
    });
    $(document).on('keydown', function (e) { if (e.key === 'Escape' && popupId) { hidePopup(); } });

    // Chạm ra ngoài popup ghim thì đóng
    $(document).on('pointerdown', function (e) {
      if (!pinned) { return; }
      if (!$(e.target).closest('#province-popup, #map-container .province, #map-container .province-hit').length) { hidePopup(); }
    });

    // Điều khiển zoom
    $('#map-zoom-in').on('click', function () { zoomBy(1.5); });
    $('#map-zoom-out').on('click', function () { zoomBy(1 / 1.5); });
    $('#map-reset').on('click', function () { setView($.extend({}, vb0)); });

    // Ctrl/⌘ + cuộn để phóng to (không chặn cuộn trang thông thường)
    svgEl.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) { return; }
      e.preventDefault();
      var c = toSvg(e.clientX, e.clientY);
      zoomBy(e.deltaY < 0 ? 1.25 : 1 / 1.25, c.x, c.y);
    }, { passive: false });

    var rt = null;
    $(global).on('resize', function () { clearTimeout(rt); rt = setTimeout(updateLabels, 120); });
  }

  function bindPopupEvents() {
    var $p = $('#province-popup');
    $p.on('mouseenter', function () { popupHovered = true; clearTimeout(hideTimer); clearTimeout(showTimer); });
    $p.on('mouseleave', function () { popupHovered = false; scheduleHide(); });
    $p.on('click', '.popup-close', function () { hidePopup(); });
  }

  /* ---------- Zoom / kéo ---------- */
  function zoomLevel() { return vb0.w / view.w; }

  function toSvg(cx, cy) {
    var m = svgEl.getScreenCTM ? svgEl.getScreenCTM() : null;
    if (!m) { return { x: vb0.x + vb0.w / 2, y: vb0.y + vb0.h / 2 }; }
    var pt = svgEl.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(m.inverse());
  }

  function pinchPoints() { return Object.keys(pointers).map(function (k) { return pointers[k]; }); }
  function pinchDistance() { var p = pinchPoints(); return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
  function pinchMid() { var p = pinchPoints(); return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; }

  function setView(v) {
    var w = Math.min(vb0.w, Math.max(vb0.w / MAX_ZOOM, v.w));
    var h = w * vb0.h / vb0.w;
    var x = Math.min(vb0.x + vb0.w - w, Math.max(vb0.x, v.x));
    var y = Math.min(vb0.y + vb0.h - h, Math.max(vb0.y, v.y));
    view = { x: x, y: y, w: w, h: h };
    svgEl.setAttribute('viewBox', [x, y, w, h].join(' '));
    $svg.toggleClass('is-zoomed', zoomLevel() > 1.02);
    updateLabels();
  }

  function zoomBy(factor, cx, cy) {
    if (cx == null) { cx = view.x + view.w / 2; cy = view.y + view.h / 2; }
    var w = Math.min(vb0.w, Math.max(vb0.w / MAX_ZOOM, view.w / factor));
    var s = w / view.w;
    setView({ x: cx - (cx - view.x) * s, y: cy - (cy - view.y) * s, w: w, h: view.h * s });
  }

  /** Luôn hiện tên các thành phố trực thuộc trung ương; hiện tên tỉnh khi đang chọn. */
  function updateLabels() {
    if (!svgEl) { return; }
    var m = svgEl.getScreenCTM ? svgEl.getScreenCTM() : null;
    var a = m ? m.a : 0.7;
    $svg.find('#labels').css('font-size', (9 / a) + 'px');
    labelLeaderLayer.textContent = '';
    $svg.find('.province-label').each(function () {
      var id = this.getAttribute('data-for');
      var offset = CITY_LABEL_OFFSETS[id];
      var isVisible = ALWAYS_VISIBLE_PROVINCES[id] || this.classList.contains('is-active');
      this.classList.toggle('is-hidden', !isVisible);
      this.setAttribute('dx', offset ? (offset.x / a).toFixed(2) : '0');
      this.setAttribute('dy', offset ? (offset.y / a).toFixed(2) : '0');

      if (offset && isVisible) {
        var line = document.createElementNS(NS, 'line');
        line.setAttribute('class', 'province-label-leader');
        line.setAttribute('x1', this.getAttribute('x'));
        line.setAttribute('y1', this.getAttribute('y'));
        line.setAttribute('x2', (+this.getAttribute('x') + offset.x / a).toFixed(2));
        line.setAttribute('y2', (+this.getAttribute('y') + offset.y / a).toFixed(2));
        labelLeaderLayer.appendChild(line);
      }
    });
  }

  /* ---------- Bảng điều khiển: lọc miền + danh sách ---------- */
  var currentMacro = 'all';

  function buildPanel() {
    var chips = '<button type="button" class="region-chip" data-macro="all" aria-pressed="true">Tất cả (' + ctx.units.length + ')</button>';
    ctx.regions.forEach(function (r) {
      chips += '<button type="button" class="region-chip" data-macro="' + r.id + '" aria-pressed="false">' + esc(r.label) + ' (' + r.provinceIds.length + ')</button>';
    });
    $('#region-chips').html(chips);
    $('#map-legend').html(ctx.regions.map(function (r) {
      return '<li class="flex items-center gap-1.5"><span class="legend-dot" style="background:var(--region-' + r.id + ')"></span>' + esc(r.label) + '</li>';
    }).join(''));

    $('#region-chips').on('click', '.region-chip', function () {
      currentMacro = $(this).data('macro');
      $('#region-chips .region-chip').attr('aria-pressed', 'false');
      $(this).attr('aria-pressed', 'true');
      applyMacro();
    });

    $('#province-list').on('mouseenter focusin', '.province-list-btn', function () { setActive($(this).data('province-id')); })
      .on('mouseleave focusout', '.province-list-btn', function () { if (!popupId) { clearActive(); } })
      .on('click', '.province-list-btn', function () { global.location.href = D.detailUrl($(this).data('province-id')); });

    applyMacro();
  }

  function applyMacro() {
    $svg.find('.province').each(function () {
      var dim = currentMacro !== 'all' && !this.classList.contains('region-' + currentMacro);
      this.classList.toggle('is-dim', dim);
    });
    var units = ctx.units.filter(function (u) { return currentMacro === 'all' || u.macro === currentMacro; })
      .sort(function (a, b) { return D.shortName(a.name).localeCompare(D.shortName(b.name), 'vi'); });
    $('#province-count').text('(' + units.length + ')');
    var groups = currentMacro === 'all' ? ctx.regions : ctx.regions.filter(function (r) { return r.id === currentMacro; });
    var html = '';
    groups.forEach(function (r) {
      var list = units.filter(function (u) { return u.macro === r.id; });
      if (!list.length) { return; }
      html += '<div class="sm:col-span-2 mt-2 first:mt-0"><p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-2 mb-1">' + esc(r.label) + '</p></div>';
      list.forEach(function (u) {
        html += '<div role="listitem"><button type="button" class="province-list-btn" data-province-id="' + esc(u.id) + '">' + esc(u.name) + '</button></div>';
      });
    });
    $('#province-list').html(html);
  }

  $(init);
})(window, jQuery);

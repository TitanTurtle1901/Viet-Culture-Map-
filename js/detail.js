/* =========================================================
   detail.js – TRANG CHI TIẾT TỈNH/THÀNH PHỐ (jQuery)
   Nhận ?id=<province-id>, tải data/provinces/<id>.json và dựng:
   banner, 5 tab (Tổng quan, Địa điểm, Đặc sản, Văn hóa, Nghệ thuật),
   bộ lọc theo đơn vị tiền thân, modal chi tiết + nguồn, địa phương liên quan.
   Trường dữ liệu rỗng không được hiển thị.
   Phụ thuộc: jQuery, data.js, main.js
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data, U = global.VCM.ui, esc = D.escapeHtml, has = D.hasValue;

  var ctx, prov, unit, sources;
  var registry = { destinations: [], specialties: [], arts: [], culture: [] };
  var filters = { destinations: 'all', specialties: 'all', arts: 'all', culture: 'all' };
  var lastFocus = null;

  var TABS = [
    { id: 'overview', slug: 'tong-quan', label: 'Tổng quan' },
    { id: 'destinations', slug: 'dia-diem', label: 'Địa điểm' },
    { id: 'specialties', slug: 'dac-san', label: 'Đặc sản' },
    { id: 'culture', slug: 'van-hoa', label: 'Văn hóa' },
    { id: 'arts', slug: 'nghe-thuat', label: 'Nghệ thuật' }
  ];

  var CULTURE_SECTIONS = [
    ['communities', 'Cộng đồng dân tộc'],
    ['customs', 'Phong tục tập quán'],
    ['festivals', 'Lễ hội truyền thống'],
    ['traditionalCostumes', 'Trang phục truyền thống'],
    ['communityLife', 'Đời sống cộng đồng và văn hóa sinh hoạt'],
    ['architectureAndLivingSpaces', 'Kiến trúc và không gian sống'],
    ['beliefsAndPractices', 'Tín ngưỡng và thực hành văn hóa'],
    ['culturalHeritage', 'Di sản văn hóa']
  ];

  var STATUS_LABEL = { needs_review: 'Dữ liệu đang chờ rà soát', verified: 'Đã rà soát', draft: 'Bản nháp' };

  /* ---------- Hàm dựng HTML nhỏ ---------- */
  function sentences(text) { return String(text || '').trim().split(/(?<=[.!?])\s+(?=[A-ZÀ-ỸĐ])/); }

  /** Tách đoạn dài thành các đoạn ngắn (mỗi đoạn n câu) để dễ đọc */
  function paragraphs(text, n) {
    if (!has(text)) { return ''; }
    var s = sentences(text), out = [];
    for (var i = 0; i < s.length; i += (n || 3)) { out.push('<p>' + esc(s.slice(i, i + (n || 3)).join(' ')) + '</p>'); }
    return '<div class="prose-vi">' + out.join('') + '</div>';
  }

  function dlRow(label, valueHtml) {
    return valueHtml ? '<div><dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd></div>' : '';
  }

  function card(title, inner, extraClass) {
    if (!inner) { return ''; }
    return '<section class="bg-white rounded-2xl shadow-card border border-cream-200 p-5 sm:p-7 ' + (extraClass || '') + '">' +
      '<h3 class="font-display text-2xl font-bold text-deep-700 mb-3">' + esc(title) + '</h3>' + inner + '</section>';
  }

  function listHtml(arr) {
    var items = (arr || []).filter(has);
    return items.length ? '<ul class="list-disc pl-5 space-y-1 leading-relaxed">' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
  }

  function unitNames(item) {
    var ids = item.originUnitIds || [];
    return ids.map(function (uid) {
      var f = prov.formerUnits.filter(function (x) { return x.id === uid; })[0];
      return f ? f.name : uid;
    });
  }

  function originBadge(item) {
    var names = unitNames(item);
    return names.length ? '<span class="badge badge-origin" title="Đơn vị tiền thân (suy ra từ trường originArea)">' + esc(names.join(' · ')) + '</span>' : '';
  }

  function firstPart(s) { return String(s || '').split(/;\s*/)[0]; }

  /* ---------- Nguồn tham khảo ---------- */
  function sourceItem(s) {
    var meta = [s.publisher, s.publishedDate ? 'công bố ' + s.publishedDate : '', s.accessedAt ? 'truy cập ' + s.accessedAt : '',
                s.reliabilityTier ? 'độ tin cậy hạng ' + s.reliabilityTier : ''].filter(has).join(' · ');
    var title = esc(s.title);
    var link = /^https?:\/\//.test(s.url || '')
      ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" class="font-medium text-deep-700 underline hover:text-crimson-600">' + title + '</a>'
      : '<span class="font-medium text-deep-700">' + title + '</span>';
    return '<li class="py-2.5 border-b border-dashed border-cream-200 last:border-0">' + link +
      '<div class="text-xs text-gray-600 mt-0.5">' + esc(meta) + '</div>' +
      (has(s.notes) ? '<div class="text-xs text-gray-500 mt-0.5">' + esc(s.notes) + '</div>' : '') + '</li>';
  }

  function sourcesList(ids) {
    var list = (ids || []).map(function (id) { return sources[id]; }).filter(Boolean);
    return list.length ? '<ul class="text-sm">' + list.map(sourceItem).join('') + '</ul>' : '';
  }

  /* ---------- Banner ---------- */
  function renderBanner() {
    var former = prov.formerUnits.length > 1
      ? '<p class="mt-3 text-sm text-white/85">Hợp nhất từ: ' + prov.formerUnits.map(function (f) { return '<span class="inline-block bg-white/15 rounded-full px-3 py-0.5 mr-1.5 mb-1">' + esc(f.name) + '</span>'; }).join('') + '</p>' : '';
    var status = prov.metadata && prov.metadata.researchStatus;
    $('#detail-banner').html(
      '<div class="banner-silhouette" data-silhouette="' + esc(unit.id) + '" aria-hidden="true"></div>' +
      '<div class="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pb-16">' +
        '<nav aria-label="Breadcrumb" class="text-sm text-white/75 mb-5"><a class="hover:text-ochre-400" href="index.html">Trang chủ</a> <span aria-hidden="true">›</span> ' +
          '<a class="hover:text-ochre-400" href="explore.html">Khám phá</a> <span aria-hidden="true">›</span> <span aria-current="page">' + esc(unit.name) + '</span></nav>' +
        '<div class="max-w-3xl">' +
          '<div class="flex flex-wrap items-center gap-2 mb-3">' + U.macroBadge(ctx, unit.macro) +
            '<span class="text-sm text-white/80">' + esc(unit.administrativeType) + ' · ' + esc(unit.region) + '</span>' +
            (status && status !== 'verified' ? '<span class="badge badge-warn">' + esc(STATUS_LABEL[status] || status) + '</span>' : '') + '</div>' +
          '<h1 class="font-display text-4xl sm:text-5xl font-bold leading-tight">' + esc(prov.name) + '</h1>' +
          former +
          '<p class="mt-4 text-white/90 leading-relaxed text-base sm:text-lg">' + esc(D.firstSentences(prov.summary.shortIntroduction, 2)) + '</p>' +
          '<div class="mt-6 flex flex-wrap gap-3">' +
            '<a href="explore.html" id="back-btn" class="btn-secondary">← Quay lại</a>' +
            '<a href="index.html#ban-do" class="btn-secondary !bg-transparent !text-white !border-white/50 hover:!bg-white/10">Xem trên bản đồ</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    U.hydrateSilhouettes($('#detail-banner'));
  }

  /* ---------- Tab Tổng quan ---------- */
  function renderOverview() {
    var o = prov.detail.overview, macro = ctx.macroById[unit.macro];
    var pop = o.population && has(o.population.value)
      ? D.formatNumber(o.population.value, 0) + ' ' + (o.population.unit || 'người') + (o.population.year ? ' (năm ' + o.population.year + ')' : '') : '';
    var area = has(o.areaKm2) ? D.formatNumber(o.areaKm2, 2) + ' km²' + (o.areaYear ? ' (năm ' + o.areaYear + ')' : '') : '';

    var admin = '<dl class="info-dl">' +
      dlRow('Tên chính thức', has(o.officialName) ? esc(o.officialName) : '') +
      dlRow('Mã đơn vị hành chính', has(o.administrativeCode) ? esc(o.administrativeCode) : '') +
      dlRow('Loại đơn vị', esc(unit.administrativeType)) +
      dlRow('Vùng miền', (macro ? esc(macro.label) + ' <span class="text-xs text-gray-500">(quy ước của dự án)</span><br>' : '') +
        '<span class="text-gray-700">Vùng địa lý – kinh tế: ' + esc(unit.region) + '</span>') +
      dlRow('Trung tâm hành chính', has(o.administrativeCenter) ? esc(o.administrativeCenter) : '') +
      dlRow('Biển số xe', has(o.vehiclePlateCodes) ? esc(o.vehiclePlateCodes.join(', ')) : '') +
      dlRow('Diện tích', esc(area)) +
      dlRow('Dân số', esc(pop)) +
      '</dl>';

    var geoInner = '<dl class="info-dl">' +
      dlRow('Vị trí địa lý', has(o.geographicLocation) ? esc(o.geographicLocation) : '') +
      dlRow('Ranh giới', listHtml(o.boundaries)) +
      dlRow('Đặc điểm tự nhiên', has(o.naturalFeatures) ? esc(o.naturalFeatures) : '') +
      dlRow('Khí hậu', has(o.climate) ? esc(o.climate) : '') + '</dl>';

    var chips = prov.formerUnits.map(function (f) { return '<span class="badge badge-origin !text-sm !px-3 !py-1">' + esc(f.name) + '</span>'; }).join(' ');
    var historyInner =
      '<p class="text-sm text-gray-600 mb-3">' + (prov.formerUnits.length > 1
        ? 'Đơn vị hiện hành được hình thành từ ' + prov.formerUnits.length + ' đơn vị cấp tỉnh tiền thân:'
        : 'Đơn vị hiện hành giữ nguyên địa giới của đơn vị cấp tỉnh trước đây:') + '</p>' +
      '<div class="flex flex-wrap gap-2 mb-4">' + chips + '</div>' + paragraphs(o.history, 3);

    var srcOverview = sourcesList(o.sourceIds);
    var allIds = D.collectSourceIds(prov);
    var meta = prov.metadata || {};
    var notes = listHtml(meta.notes);
    var derived = listHtml(meta.derivedFields);
    var noteInner = '<div class="flex flex-wrap items-center gap-2 mb-3">' +
        '<span class="badge badge-warn">' + esc(STATUS_LABEL[meta.researchStatus] || meta.researchStatus || '') + '</span>' +
        (meta.lastVerified ? '<span class="text-sm text-gray-600">Kiểm tra lần cuối: ' + esc(meta.lastVerified) + '</span>' : '') +
        (meta.asOfDate ? '<span class="text-sm text-gray-600">· Số liệu tính đến: ' + esc(meta.asOfDate) + '</span>' : '') + '</div>' +
      (notes ? '<h4 class="font-semibold text-deep-700 mt-3 mb-1">Ghi chú của người biên soạn</h4><div class="text-sm">' + notes + '</div>' : '') +
      (derived ? '<h4 class="font-semibold text-deep-700 mt-4 mb-1">Trường dẫn xuất tự động</h4><div class="text-sm">' + derived + '</div>' : '');

    return '<div class="grid gap-6 lg:grid-cols-2">' +
        card('Thông tin hành chính hiện hành', admin) +
        card('Thông tin địa lý', geoInner.indexOf('<dt>') >= 0 ? geoInner : '') +
      '</div>' +
      '<div class="grid gap-6 mt-6">' +
        card('Lịch sử hình thành và đơn vị tiền thân', historyInner) +
        card('Giới thiệu tổng quan', paragraphs(o.description, 3)) +
        '<section class="bg-white rounded-2xl shadow-card border border-cream-200 p-5 sm:p-7">' +
          '<h3 class="font-display text-2xl font-bold text-deep-700 mb-3">Nguồn tham khảo và ghi chú dữ liệu</h3>' +
          (srcOverview ? '<details class="mb-3"><summary class="cursor-pointer font-semibold text-deep-700">Nguồn cho phần Tổng quan (' + (o.sourceIds || []).length + ')</summary>' + srcOverview + '</details>' : '') +
          '<details class="mb-3"><summary class="cursor-pointer font-semibold text-deep-700">Toàn bộ nguồn của hồ sơ này (' + allIds.length + ')</summary>' + sourcesList(allIds) + '</details>' +
          '<details><summary class="cursor-pointer font-semibold text-deep-700">Trạng thái và ghi chú dữ liệu</summary><div class="mt-3">' + noteInner + '</div></details>' +
        '</section>' +
      '</div>';
  }

  /* ---------- Bộ lọc theo đơn vị tiền thân ---------- */
  function filterBar(kind, items) {
    if (prov.formerUnits.length < 2 || items.length < 2) { return ''; }
    var counts = {}, none = 0;
    items.forEach(function (it) {
      var ids = it.originUnitIds || [];
      if (!ids.length) { none++; }
      ids.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    });
    var html = '<div class="flex flex-wrap gap-2 mb-5" role="group" aria-label="Lọc theo khu vực tiền thân">' +
      '<span class="self-center text-sm font-semibold text-deep-700 mr-1">Khu vực tiền thân:</span>' +
      '<button type="button" class="chip" data-filter-kind="' + kind + '" data-filter="all" aria-pressed="' + (filters[kind] === 'all') + '">Tất cả (' + items.length + ')</button>';
    prov.formerUnits.forEach(function (f) {
      if (!counts[f.id]) { return; }
      html += '<button type="button" class="chip" data-filter-kind="' + kind + '" data-filter="' + esc(f.id) + '" aria-pressed="' + (filters[kind] === f.id) + '">' + esc(f.name) + ' (' + counts[f.id] + ')</button>';
    });
    if (none) { html += '<button type="button" class="chip" data-filter-kind="' + kind + '" data-filter="none" aria-pressed="' + (filters[kind] === 'none') + '" title="Mục không gắn với riêng một đơn vị tiền thân">Chung / chưa phân định (' + none + ')</button>'; }
    return html + '</div>';
  }

  function passes(kind, item) {
    var f = filters[kind];
    if (f === 'all') { return true; }
    var ids = item.originUnitIds || [];
    return f === 'none' ? !ids.length : ids.indexOf(f) >= 0;
  }

  /* ---------- Thẻ địa điểm / đặc sản / nghệ thuật ---------- */
  function itemCard(kind, item, idx) {
    var desc = kind === 'destinations' ? item.shortDescription : kind === 'specialties' ? (item.characteristics || item.origin) : (item.characteristics || item.origin);
    var sub = kind === 'destinations' ? (has(item.location) ? 'Vị trí: ' + item.location : '')
      : kind === 'arts' ? (has(item.communityOrArea) ? 'Cộng đồng/khu vực: ' + item.communityOrArea : '') : '';
    var origin = has(item.originArea) ? '<p class="text-xs text-gray-500 line-clamp-2" title="' + esc(item.originArea) + '">Nguồn gốc: ' + esc(item.originArea) + '</p>' : '';
    return '<article class="card-hover bg-white rounded-2xl shadow-card overflow-hidden flex flex-col">' +
      U.itemThumb(item, kind === 'destinations' ? 'destination' : kind === 'specialties' ? 'specialty' : 'art', unit.macro, 'h-40') +
      '<div class="p-4 flex flex-col gap-2 flex-1">' +
        '<div class="flex flex-wrap gap-1.5">' + (has(item.category) ? '<span class="badge badge-cat">' + esc(firstPart(item.category)) + '</span>' : '') + originBadge(item) + '</div>' +
        '<h4 class="font-display text-lg font-bold text-deep-700 leading-snug">' + esc(item.name) + '</h4>' +
        (has(desc) ? '<p class="text-sm text-gray-700 line-clamp-3">' + esc(desc) + '</p>' : '') +
        (sub ? '<p class="text-xs text-gray-600 line-clamp-2">' + esc(sub) + '</p>' : '') + origin +
        '<button type="button" class="btn-forest self-start mt-auto open-item" style="margin-top:.6rem" data-ref="' + kind + '|' + idx + '" aria-haspopup="dialog">Xem chi tiết</button>' +
      '</div></article>';
  }

  function renderList(kind) {
    var items = registry[kind];
    var html = '';
    items.forEach(function (it, idx) { if (passes(kind, it)) { html += '<div>' + itemCard(kind, it, idx) + '</div>'; } });
    $('#list-' + kind).html(html || '<p class="col-span-full text-gray-600 py-6">Không có mục nào thuộc khu vực này.</p>');
  }

  function listSection(kind, intro) {
    var items = registry[kind];
    if (!items.length) { return '<p class="text-gray-600 py-6">Hồ sơ chưa có dữ liệu cho mục này.</p>'; }
    return '<p class="text-gray-600 mb-4 max-w-3xl">' + esc(intro) + '</p>' +
      '<div id="filter-' + kind + '">' + filterBar(kind, items) + '</div>' +
      '<div id="list-' + kind + '" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"></div>';
  }

  /* ---------- Tab Văn hóa ---------- */
  function cultureCard(entry, idx) {
    var it = entry.item;
    var when = it.timeAndLocation || it.time;
    return '<article class="card-hover bg-white rounded-2xl shadow-card border border-cream-200 p-5 flex flex-col gap-2">' +
      '<div class="flex flex-wrap gap-1.5">' + originBadge(it) +
        (has(it.recognition) ? '<span class="badge badge-cat" title="' + esc(it.recognition) + '">Có ghi nhận / xếp hạng</span>' : '') + '</div>' +
      '<h5 class="font-display text-lg font-bold text-deep-700 leading-snug">' + esc(it.name) + '</h5>' +
      (has(when) ? '<p class="text-xs font-semibold text-ochre-600">' + esc(when) + '</p>' : '') +
      (has(it.description) ? '<p class="text-sm text-gray-700 line-clamp-4">' + esc(it.description) + '</p>' : '') +
      (has(it.originArea) ? '<p class="text-xs text-gray-500 line-clamp-2" title="' + esc(it.originArea) + '">Nguồn gốc: ' + esc(it.originArea) + '</p>' : '') +
      '<button type="button" class="btn-forest self-start mt-auto open-item" style="margin-top:.5rem" data-ref="culture|' + idx + '" aria-haspopup="dialog">Chi tiết và nguồn</button>' +
    '</article>';
  }

  function renderCultureList() {
    var html = '';
    CULTURE_SECTIONS.forEach(function (sec) {
      var cards = '', count = 0;
      registry.culture.forEach(function (e, idx) {
        if (e.key !== sec[0] || !passes('culture', e.item)) { return; }
        cards += '<div>' + cultureCard(e, idx) + '</div>'; count++;
      });
      if (count) {
        html += '<section class="mb-10" aria-labelledby="cs-' + sec[0] + '"><h3 id="cs-' + sec[0] + '" class="font-display text-2xl font-bold text-deep-700 mb-4">' + esc(sec[1]) +
          ' <span class="text-base font-sans font-medium text-gray-500">(' + count + ')</span></h3><div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">' + cards + '</div></section>';
      }
    });
    $('#list-culture').html(html || '<p class="text-gray-600 py-6">Không có mục nào thuộc khu vực này.</p>');
  }

  /* ---------- Modal ---------- */
  var FIELDS = {
    destinations: [['location', 'Vị trí hiện hành'], ['originArea', 'Khu vực tiền thân có nguồn gốc'], ['coordinates', 'Tọa độ'],
      ['fullDescription', 'Giới thiệu'], ['highlights', 'Điểm nổi bật'], ['historicalCulturalValue', 'Giá trị lịch sử – văn hóa'],
      ['recognition', 'Công nhận / xếp hạng'], ['visitorInformation', 'Thông tin cho du khách']],
    specialties: [['originArea', 'Khu vực tiền thân có nguồn gốc'], ['origin', 'Nguồn gốc'], ['ingredients', 'Nguyên liệu'],
      ['preparation', 'Cách chế biến'], ['characteristics', 'Hương vị và đặc điểm'], ['culturalContext', 'Giá trị văn hóa và địa phương'], ['recognition', 'Công nhận']],
    arts: [['originArea', 'Khu vực tiền thân có nguồn gốc'], ['communityOrArea', 'Cộng đồng / khu vực thực hành'], ['origin', 'Nguồn gốc'],
      ['characteristics', 'Đặc điểm'], ['instrumentsOrPerformance', 'Nhạc cụ / hình thức biểu diễn'], ['culturalValue', 'Giá trị văn hóa'], ['recognition', 'Công nhận']],
    culture: [['originArea', 'Khu vực tiền thân có nguồn gốc'], ['time', 'Thời gian'], ['timeAndLocation', 'Thời gian và địa điểm'], ['communityOrArea', 'Cộng đồng / khu vực'],
      ['description', 'Mô tả'], ['recognition', 'Công nhận']]
  };

  function fieldHtml(label, v) {
    if (!has(v)) { return ''; }
    var body;
    if (Array.isArray(v)) { body = listHtml(v); }
    else if (typeof v === 'object') {
      body = '<p>' + esc(Object.keys(v).filter(function (k) { return has(v[k]); }).map(function (k) { return k + ': ' + v[k]; }).join(', ')) + '</p>';
    } else { body = '<p>' + esc(v) + '</p>'; }
    return '<h4>' + esc(label) + '</h4>' + body;
  }

  function openItem(ref) {
    var parts = ref.split('|'), kind = parts[0], idx = +parts[1];
    var entry = registry[kind][idx];
    var item = kind === 'culture' ? entry.item : entry;
    var secLabel = kind === 'culture' ? (CULTURE_SECTIONS.filter(function (s) { return s[0] === entry.key; })[0] || [])[1] : '';
    var kindForThumb = kind === 'destinations' ? 'destination' : kind === 'specialties' ? 'specialty' : 'art';

    var html = '' +
      (kind === 'culture' ? '' : U.itemThumb(item, kindForThumb, unit.macro, 'h-44 rounded-xl mb-5')) +
      '<div class="flex flex-wrap gap-1.5 mb-2">' +
        (secLabel ? '<span class="badge badge-cat">' + esc(secLabel) + '</span>' : '') +
        (has(item.category) ? '<span class="badge badge-cat">' + esc(item.category) + '</span>' : '') + originBadge(item) + '</div>' +
      '<h3 id="modal-title" class="font-display text-2xl sm:text-3xl font-bold text-deep-700 leading-snug">' + esc(item.name) + '</h3>';

    FIELDS[kind].forEach(function (f) { html += fieldHtml(f[1], item[f[0]]); });

    var srcIds = (item.sourceIds || []).slice();
    if (item.image && item.image.sourceId && srcIds.indexOf(item.image.sourceId) < 0) { srcIds.push(item.image.sourceId); }
    var srcHtml = sourcesList(srcIds);
    html += '<h4>Nguồn tham khảo</h4>' + (srcHtml || '<p class="text-sm text-gray-600">Mục này chưa gắn nguồn riêng; xem nguồn chung của hồ sơ ở tab Tổng quan.</p>');

    lastFocus = document.activeElement;
    $('#modal-content').html(html);
    U.hydrateSilhouettes($('#modal-content'));
    $('#item-modal').addClass('is-open').attr('aria-hidden', 'false');
    $('body').addClass('modal-open');
    $('#item-modal .modal-panel').scrollTop(0);
    $('#modal-close').trigger('focus');
  }

  function closeModal() {
    $('#item-modal').removeClass('is-open').attr('aria-hidden', 'true');
    $('body').removeClass('modal-open');
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  /* ---------- Tab ---------- */
  function activateTab(id, updateHash) {
    var tab = TABS.filter(function (t) { return t.id === id; })[0] || TABS[0];
    $('#tab-list .tab-btn').each(function () {
      var on = $(this).data('tab') === tab.id;
      $(this).attr({ 'aria-selected': on, tabindex: on ? 0 : -1 });
    });
    $('#tab-panels .tab-panel').removeClass('is-active').attr('hidden', true);
    $('#panel-' + tab.id).addClass('is-active').removeAttr('hidden');
    if (updateHash) { global.history.replaceState(null, '', global.location.pathname + global.location.search + '#' + tab.slug); }
    var btn = $('#tab-list .tab-btn[data-tab="' + tab.id + '"]')[0];
    if (btn && btn.scrollIntoView) { btn.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  }

  function tabFromHash() {
    var h = global.location.hash.replace('#', '');
    var t = TABS.filter(function (x) { return x.slug === h; })[0];
    return t ? t.id : 'overview';
  }

  function render() {
    document.title = prov.name + ' – Viet Culture Map';
    var d = prov.detail;
    registry.destinations = d.destinations || [];
    registry.specialties = d.specialties || [];
    registry.arts = d.arts || [];
    registry.culture = [];
    CULTURE_SECTIONS.forEach(function (sec) {
      ((d.culture || {})[sec[0]] || []).forEach(function (it) { if (has(it)) { registry.culture.push({ key: sec[0], item: it }); } });
    });

    renderBanner();

    var counts = { destinations: registry.destinations.length, specialties: registry.specialties.length, culture: registry.culture.length, arts: registry.arts.length };
    $('#tab-list').html(TABS.map(function (t) {
      return '<button type="button" role="tab" id="tab-' + t.id + '" class="tab-btn" data-tab="' + t.id + '" aria-controls="panel-' + t.id + '" aria-selected="false" tabindex="-1">' +
        esc(t.label) + (counts[t.id] ? '<span class="tab-count">' + counts[t.id] + '</span>' : '') + '</button>';
    }).join(''));

    var cultureBody = registry.culture.length
      ? '<p class="text-gray-600 mb-4 max-w-3xl">Phong tục, lễ hội, trang phục, đời sống cộng đồng, tín ngưỡng và di sản của toàn bộ không gian văn hóa, ghi rõ khu vực tiền thân.</p><div id="filter-culture">' + filterBar('culture', registry.culture.map(function (e) { return e.item; })) + '</div><div id="list-culture"></div>'
      : '<p class="text-gray-600 py-6">Hồ sơ chưa có dữ liệu cho mục này.</p>';

    $('#tab-panels').html(
      '<div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" class="tab-panel" hidden>' + renderOverview() + '</div>' +
      '<div id="panel-destinations" role="tabpanel" aria-labelledby="tab-destinations" class="tab-panel" hidden>' + listSection('destinations', 'Địa điểm nổi tiếng từ tất cả các đơn vị tiền thân. Nhấn vào một địa điểm để xem thông tin mở rộng và nguồn.') + '</div>' +
      '<div id="panel-specialties" role="tabpanel" aria-labelledby="tab-specialties" class="tab-panel" hidden>' + listSection('specialties', 'Đặc sản và sản phẩm truyền thống của mọi khu vực tiền thân, kèm nguồn gốc, nguyên liệu và cách chế biến.') + '</div>' +
      '<div id="panel-culture" role="tabpanel" aria-labelledby="tab-culture" class="tab-panel" hidden>' + cultureBody + '</div>' +
      '<div id="panel-arts" role="tabpanel" aria-labelledby="tab-arts" class="tab-panel" hidden>' + listSection('arts', 'Dân ca, nhạc cụ, nghệ thuật biểu diễn và các loại hình nghệ thuật đặc trưng.') + '</div>'
    );

    ['destinations', 'specialties', 'arts'].forEach(function (k) { if (registry[k].length) { renderList(k); } });
    if (registry.culture.length) { renderCultureList(); }

    // Địa phương liên quan: cùng miền trước, bổ sung từ nơi khác; không trùng địa phương hiện tại
    var pool = ctx.units.filter(function (u) { return u.id !== unit.id; });
    var curIdx = ctx.units.indexOf(unit);
    pool.sort(function (a, b) {
      var sa = a.macro === unit.macro ? 0 : 1, sb = b.macro === unit.macro ? 0 : 1;
      if (sa !== sb) { return sa - sb; }
      var da = (ctx.units.indexOf(a) - curIdx + 34) % 34, db = (ctx.units.indexOf(b) - curIdx + 34) % 34;
      return da - db;
    });
    $('#related-grid').html(pool.slice(0, 4).map(function (u) { return U.provinceCard(u, ctx); }).join(''));
    U.hydrateSilhouettes($('#related-grid'));

    activateTab(tabFromHash(), false);
  }

  /* ---------- Sự kiện ---------- */
  function bind() {
    $('#tab-list').on('click', '.tab-btn', function () { activateTab($(this).data('tab'), true); });
    $('#tab-list').on('keydown', '.tab-btn', function (e) {
      var order = TABS.map(function (t) { return t.id; }), i = order.indexOf($(this).data('tab')), n = null;
      if (e.key === 'ArrowRight') { n = (i + 1) % order.length; }
      else if (e.key === 'ArrowLeft') { n = (i - 1 + order.length) % order.length; }
      else if (e.key === 'Home') { n = 0; } else if (e.key === 'End') { n = order.length - 1; }
      if (n !== null) { e.preventDefault(); activateTab(order[n], true); $('#tab-' + order[n]).trigger('focus'); }
    });
    $(global).on('hashchange', function () { activateTab(tabFromHash(), false); });

    $('#tab-panels').on('click', '.chip[data-filter-kind]', function () {
      var kind = $(this).data('filter-kind');
      filters[kind] = String($(this).data('filter'));
      $('#filter-' + kind + ' .chip').each(function () { $(this).attr('aria-pressed', String($(this).data('filter')) === filters[kind]); });
      if (kind === 'culture') { renderCultureList(); } else { renderList(kind); }
      U.observeReveal($('#panel-' + (kind === 'culture' ? 'culture' : kind)));
    });

    $('#tab-panels').on('click', '.open-item', function () { openItem($(this).data('ref')); });
    $('#modal-close').on('click', closeModal);
    $('#item-modal').on('click', function (e) { if (e.target === this) { closeModal(); } });
    $(document).on('keydown', function (e) {
      if (!$('#item-modal').hasClass('is-open')) { return; }
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key === 'Tab') {   // giữ focus trong modal
        var $f = $('#item-modal').find('a[href], button:not([disabled]), summary, [tabindex="0"]').filter(':visible');
        if (!$f.length) { return; }
        var first = $f[0], last = $f[$f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Nút “Quay lại”: về trang trước nếu đến từ trang khác của site, ngược lại về Khám phá
    $(document).on('click', '#back-btn', function (e) {
      if (document.referrer && document.referrer.indexOf(global.location.origin) === 0 && global.history.length > 1) {
        e.preventDefault(); global.history.back();
      }
    });
  }

  /* ---------- Khởi động ---------- */
  function fail(msg) {
    $('#detail-loading').addClass('hidden');
    $('#detail-error-msg').text(msg);
    $('#detail-error').removeClass('hidden');
  }

  function init() {
    var id = D.getParam('id');
    if (!id) { fail('Địa chỉ trang thiếu tham số id, ví dụ detail.html?id=cao-bang.'); return; }
    D.loadContext().then(function (c) {
      ctx = c;
      unit = ctx.byId[id];
      if (!unit) { throw new Error('Không có địa phương với mã “' + id + '”. Hãy chọn từ danh sách 34 địa phương.'); }
      return Promise.all([D.loadProvince(id), D.loadSources()]);
    }).then(function (res) {
      prov = res[0]; sources = res[1];
      bind();
      render();
      $('#detail-loading').addClass('hidden');
      $('#detail-root').removeClass('hidden');
    }).catch(function (err) { fail(err.message || 'Đã xảy ra lỗi khi tải dữ liệu. Hãy chạy dự án bằng VS Code Live Server.'); });
  }

  $(init);
})(window, jQuery);

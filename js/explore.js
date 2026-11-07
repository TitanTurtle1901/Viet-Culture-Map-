/* =========================================================
   explore.js – TRANG KHÁM PHÁ (jQuery)
   Tìm kiếm (tên tỉnh, đơn vị tiền thân, địa điểm, đặc sản – không phân biệt dấu),
   lọc theo miền và đơn vị tiền thân, sắp xếp theo tên, phân trang.
   Trạng thái được đồng bộ với URL (?q=&region=&former=&sort=&per=&page=).
   Phụ thuộc: jQuery, data.js, main.js
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data, U = global.VCM.ui, esc = D.escapeHtml;
  var ctx = null;
  var state = { q: '', region: 'all', former: '', sort: 'asc', per: 9, page: 1 };

  /* ---------- Trạng thái <-> URL ---------- */
  function readUrl() {
    var p = new URLSearchParams(global.location.search);
    state.q = p.get('q') || '';
    state.region = p.get('region') || 'all';
    state.former = p.get('former') || '';
    state.sort = p.get('sort') === 'desc' ? 'desc' : 'asc';
    var per = parseInt(p.get('per'), 10);
    state.per = [6, 9, 12, 18, 34].indexOf(per) >= 0 ? per : 9;
    state.page = Math.max(1, parseInt(p.get('page'), 10) || 1);
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) { p.set('q', state.q); }
    if (state.region !== 'all') { p.set('region', state.region); }
    if (state.former) { p.set('former', state.former); }
    if (state.sort !== 'asc') { p.set('sort', state.sort); }
    if (state.per !== 9) { p.set('per', state.per); }
    if (state.page > 1) { p.set('page', state.page); }
    var qs = p.toString();
    global.history.replaceState(null, '', global.location.pathname + (qs ? '?' + qs : ''));
  }

  /* ---------- Chuẩn bị dữ liệu tìm kiếm ---------- */
  function prepare(units) {
    units.forEach(function (u) {
      u._n = {
        name: D.normalize(u.name),
        former: u.formerUnits.map(function (f) { return { raw: f.name, n: D.normalize(f.name) }; }),
        dests: u.searchNames.destinations.map(function (x) { return { raw: x, n: D.normalize(x) }; }),
        specs: u.searchNames.specialties.map(function (x) { return { raw: x, n: D.normalize(x) }; })
      };
    });
  }

  /** Trả về null nếu không khớp; ngược lại {notes: [...]} mô tả mục khớp (ngoài tên tỉnh) */
  function matchUnit(u, tokens) {
    if (!tokens.length) { return { notes: [] }; }
    var notes = [], seen = {};
    function addNote(label, raw) {
      var key = label + raw;
      if (!seen[key] && notes.length < 3) { seen[key] = 1; notes.push('<strong>' + label + ':</strong> ' + esc(raw)); }
    }
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i], hit = false;
      if (u._n.name.indexOf(t) >= 0) { hit = true; }
      u._n.former.forEach(function (f) { if (f.n.indexOf(t) >= 0) { hit = true; if (u._n.name.indexOf(t) < 0) { addNote('Tiền thân', f.raw); } } });
      u._n.dests.forEach(function (x) { if (x.n.indexOf(t) >= 0) { hit = true; addNote('Địa điểm', x.raw); } });
      u._n.specs.forEach(function (x) { if (x.n.indexOf(t) >= 0) { hit = true; addNote('Đặc sản', x.raw); } });
      if (!hit) { return null; }
    }
    return { notes: notes };
  }

  /* ---------- Lọc + sắp xếp ---------- */
  function compute() {
    var tokens = D.normalize(state.q).split(' ').filter(Boolean);
    var rows = [];
    ctx.units.forEach(function (u) {
      if (state.region !== 'all' && u.macro !== state.region) { return; }
      if (state.former && !u.formerUnits.some(function (f) { return f.id === state.former; })) { return; }
      var m = matchUnit(u, tokens);
      if (m) { rows.push({ unit: u, notes: m.notes }); }
    });
    rows.sort(function (a, b) {
      var c = D.shortName(a.unit.name).localeCompare(D.shortName(b.unit.name), 'vi');
      return state.sort === 'asc' ? c : -c;
    });
    return rows;
  }

  /* ---------- Hiển thị ---------- */
  function render() {
    var rows = compute();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / state.per));
    if (state.page > pages) { state.page = pages; }
    var start = (state.page - 1) * state.per;
    var slice = rows.slice(start, start + state.per);

    $('#result-summary').text(total
      ? 'Tìm thấy ' + total + ' địa phương · hiển thị ' + (start + 1) + '–' + (start + slice.length)
      : 'Không có địa phương nào khớp.');

    $('#explore-grid').toggleClass('hidden', !total).html(slice.map(function (r) {
      return U.provinceCard(r.unit, ctx, { cta: 'Xem chi tiết', matchNote: r.notes.join(' · ') });
    }).join(''));
    $('#empty-state').toggleClass('hidden', total > 0);
    U.hydrateSilhouettes($('#explore-grid'));
    renderPagination(pages);
    writeUrl();
  }

  function pageList(current, pages) {
    var set = {};
    [1, pages, current - 1, current, current + 1].forEach(function (p) { if (p >= 1 && p <= pages) { set[p] = 1; } });
    var arr = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    var out = [];
    arr.forEach(function (p, i) {
      if (i && p - arr[i - 1] > 1) { out.push('…'); }
      out.push(p);
    });
    return out;
  }

  function renderPagination(pages) {
    var $nav = $('#pagination');
    if (pages <= 1) { $nav.empty(); return; }
    var html = '<button type="button" class="page-btn" data-page="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>‹ Trước</button>';
    pageList(state.page, pages).forEach(function (p) {
      html += p === '…'
        ? '<span class="px-1 text-gray-500" aria-hidden="true">…</span>'
        : '<button type="button" class="page-btn" data-page="' + p + '"' + (p === state.page ? ' aria-current="page"' : '') + ' aria-label="Trang ' + p + '">' + p + '</button>';
    });
    html += '<button type="button" class="page-btn" data-page="' + (state.page + 1) + '"' + (state.page === pages ? ' disabled' : '') + '>Sau ›</button>';
    $nav.html(html);
  }

  function syncControls() {
    $('#q').val(state.q);
    $('#sort').val(state.sort);
    $('#former').val(state.former);
    $('#per-page').val(String(state.per));
    $('#explore-region-chips .chip').each(function () { $(this).attr('aria-pressed', $(this).data('region') === state.region); });
  }

  function buildControls() {
    var chips = '<button type="button" class="chip" data-region="all" aria-pressed="true">Tất cả</button>' +
      ctx.regions.map(function (r) { return '<button type="button" class="chip" data-region="' + r.id + '" aria-pressed="false">' + esc(r.label) + '</button>'; }).join('');
    $('#explore-region-chips').html(chips);

    var opts = [];
    ctx.units.forEach(function (u) {
      u.formerUnits.forEach(function (f) { opts.push({ id: f.id, name: f.name, now: D.shortName(u.name) }); });
    });
    opts.sort(function (a, b) { return a.name.localeCompare(b.name, 'vi'); });
    $('#former').append(opts.map(function (o) {
      return '<option value="' + esc(o.id) + '">' + esc(o.name) + (o.name === o.now ? '' : ' → nay thuộc ' + esc(o.now)) + '</option>';
    }).join(''));
  }

  function resetAll() {
    state = { q: '', region: 'all', former: '', sort: 'asc', per: state.per, page: 1 };
    syncControls();
    render();
  }

  function bind() {
    var t = null;
    $('#q').on('input', function () {
      var v = $(this).val();
      clearTimeout(t);
      t = setTimeout(function () { state.q = v.trim(); state.page = 1; render(); }, 180);
    });
    $('#sort').on('change', function () { state.sort = $(this).val(); state.page = 1; render(); });
    $('#former').on('change', function () { state.former = $(this).val(); state.page = 1; render(); });
    $('#per-page').on('change', function () { state.per = parseInt($(this).val(), 10); state.page = 1; render(); });
    $('#explore-region-chips').on('click', '.chip', function () {
      state.region = $(this).data('region'); state.page = 1; syncControls(); render();
    });
    $('#pagination').on('click', '.page-btn:not(:disabled)', function () {
      state.page = parseInt($(this).data('page'), 10);
      render();
      var top = $('#result-summary').offset().top - 90;
      global.scrollTo({ top: top, behavior: 'smooth' });
    });
    $('#reset-filters, #empty-reset').on('click', resetAll);
  }

  function init() {
    D.loadContext().then(function (c) {
      ctx = c;
      prepare(ctx.units);
      readUrl();
      buildControls();
      syncControls();
      bind();
      render();
    }).catch(function (err) {
      $('#explore-grid').html('<p class="col-span-full text-center text-crimson-700" role="alert">Không tải được dữ liệu: ' + esc(err.message) + '. Hãy chạy dự án bằng VS Code Live Server.</p>');
    });
  }

  $(init);
})(window, jQuery);

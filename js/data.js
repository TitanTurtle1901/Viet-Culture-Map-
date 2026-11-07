/* =========================================================
   data.js – LỚP DỮ LIỆU (JavaScript thuần, không đụng DOM)
   - Tải JSON, lưu cache, nối dữ liệu hồ sơ với phân vùng.
   - Hàm tiện ích: chuẩn hóa chuỗi, định dạng số, kiểm tra giá trị rỗng.
   - Phiên đăng nhập mô phỏng (localStorage/sessionStorage).
   jQuery chỉ dùng ở các file còn lại (main/map/explore/detail/auth).
   ========================================================= */
(function (global) {
  'use strict';

  var PATHS = {
    index: 'data/provinces/index.json',
    regions: 'data/regions.json',
    sources: 'data/sources.json',
    province: function (id) { return 'data/provinces/' + encodeURIComponent(id) + '.json'; },
    mapSvg: 'assets/maps/vietnam-34-provinces.svg'
  };

  var cache = {};
  function getJSON(path) {
    if (!cache[path]) {
      cache[path] = fetch(path).then(function (res) {
        if (!res.ok) { throw new Error('Không tải được ' + path + ' (HTTP ' + res.status + ')'); }
        return res.json();
      }).catch(function (err) { delete cache[path]; throw err; });
    }
    return cache[path];
  }

  /* ---------- Chuẩn hóa chuỗi ---------- */
  function normalize(str) {
    return String(str == null ? '' : str)
      .toLowerCase()
      .replace(/đ/g, 'd')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** "Thành phố Hà Nội" / "Tỉnh Cao Bằng" -> "Hà Nội" / "Cao Bằng" (dùng để sắp xếp & nhãn) */
  function shortName(name) {
    return String(name || '').replace(/^(Thành phố|Tỉnh)\s+/i, '');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** true nếu giá trị có nội dung hiển thị được (không null, '', [], {} rỗng) */
  function hasValue(v) {
    if (v === null || v === undefined) { return false; }
    if (typeof v === 'string') { return v.trim() !== ''; }
    if (Array.isArray(v)) { return v.some(hasValue); }
    if (typeof v === 'object') { return Object.keys(v).some(function (k) { return hasValue(v[k]); }); }
    return true;
  }

  function formatNumber(n, digits) {
    if (typeof n !== 'number' || isNaN(n)) { return ''; }
    return n.toLocaleString('vi-VN', { maximumFractionDigits: digits == null ? 2 : digits });
  }

  /** Lấy tối đa n câu đầu của đoạn văn. Tách câu ở dấu .!? theo sau là chữ cái in hoa. */
  function firstSentences(text, n) {
    var s = String(text || '').trim();
    if (!s) { return ''; }
    var parts = s.split(/(?<=[.!?])\s+(?=[A-ZÀ-ỸĐ])/);
    return parts.slice(0, n).join(' ');
  }

  /* ---------- Tải dữ liệu ---------- */
  var loaded = null;
  /** Tải index + regions và dựng các bảng tra cứu. Trả về Promise<Context>. */
  function loadContext() {
    if (!loaded) {
      loaded = Promise.all([getJSON(PATHS.index), getJSON(PATHS.regions)]).then(function (res) {
        var index = res[0], regions = res[1];
        var macroByProvince = {};
        regions.regions.forEach(function (r) {
          r.provinceIds.forEach(function (pid) { macroByProvince[pid] = r.id; });
        });
        var byId = {};
        index.units.forEach(function (u) { byId[u.id] = u; u.macro = macroByProvince[u.id]; });
        var macroById = {};
        regions.regions.forEach(function (r) { macroById[r.id] = r; });
        return { units: index.units, byId: byId, regions: regions.regions, macroById: macroById,
                 featuredIds: regions.featuredProvinceIds, regionRule: regions.rule, asOfDate: index.asOfDate };
      });
      loaded.catch(function () { loaded = null; });
    }
    return loaded;
  }

  function loadProvince(id) { return getJSON(PATHS.province(id)); }

  var sourceMap = null;
  /** Promise<{id: source}> */
  function loadSources() {
    if (!sourceMap) {
      sourceMap = getJSON(PATHS.sources).then(function (d) {
        var m = {};
        d.sources.forEach(function (s) { m[s.id] = s; });
        return m;
      });
      sourceMap.catch(function () { sourceMap = null; });
    }
    return sourceMap;
  }

  /** Gom mọi sourceId xuất hiện trong một đối tượng (đệ quy), trả về mảng duy nhất theo thứ tự xuất hiện */
  function collectSourceIds(obj) {
    var seen = {}, out = [];
    (function walk(o) {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (o && typeof o === 'object') {
        Object.keys(o).forEach(function (k) {
          var v = o[k];
          if (k === 'sourceIds' && Array.isArray(v)) {
            v.forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } });
          } else if (k === 'sourceId' && typeof v === 'string' && !seen[v]) {
            seen[v] = 1; out.push(v);
          } else { walk(v); }
        });
      }
    })(obj);
    return out;
  }

  /* ---------- URL ---------- */
  function detailUrl(id, hash) { return 'detail.html?id=' + encodeURIComponent(id) + (hash ? '#' + hash : ''); }
  function exploreUrl(params) {
    var q = [];
    Object.keys(params || {}).forEach(function (k) {
      if (hasValue(params[k])) { q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k])); }
    });
    return 'explore.html' + (q.length ? '?' + q.join('&') : '');
  }
  function getParam(name) { return new URLSearchParams(global.location.search).get(name); }

  /* ---------- Phiên đăng nhập MÔ PHỎNG (không có backend) ---------- */
  var USERS_KEY = 'vcm_users', SESSION_KEY = 'vcm_session';
  function safeParse(s, fallback) { try { return JSON.parse(s) || fallback; } catch (e) { return fallback; } }
  var session = {
    users: function () { return safeParse(global.localStorage.getItem(USERS_KEY), []); },
    saveUsers: function (list) { global.localStorage.setItem(USERS_KEY, JSON.stringify(list)); },
    get: function () {
      try {
        return safeParse(global.sessionStorage.getItem(SESSION_KEY), null) ||
               safeParse(global.localStorage.getItem(SESSION_KEY), null);
      } catch (e) { return null; }
    },
    set: function (user, remember) {
      var payload = JSON.stringify({ username: user.username, fullName: user.fullName, email: user.email });
      session.clear();
      (remember ? global.localStorage : global.sessionStorage).setItem(SESSION_KEY, payload);
    },
    clear: function () {
      try { global.localStorage.removeItem(SESSION_KEY); global.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* bỏ qua */ }
    }
  };

  global.VCM = global.VCM || {};
  global.VCM.data = {
    PATHS: PATHS, getJSON: getJSON, loadContext: loadContext, loadProvince: loadProvince, loadSources: loadSources,
    collectSourceIds: collectSourceIds, normalize: normalize, shortName: shortName, escapeHtml: escapeHtml,
    hasValue: hasValue, formatNumber: formatNumber, firstSentences: firstSentences,
    detailUrl: detailUrl, exploreUrl: exploreUrl, getParam: getParam, session: session
  };
})(window);

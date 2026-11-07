/* =========================================================
   home.js – CÁC KHU VỰC CỦA TRANG CHỦ (jQuery)
   Địa phương nổi bật, khám phá theo vùng miền, số liệu giới thiệu,
   ô tìm kiếm ở Hero. Phụ thuộc: jQuery, data.js, main.js
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data, U = global.VCM.ui, esc = D.escapeHtml;

  function regionCard(r, units) {
    var names = r.provinceIds.slice(0, 4).map(function (id) { return esc(D.shortName(units[id].name)); }).join(' · ');
    var url = D.exploreUrl({ region: r.id });
    return '<article class="reveal card-hover bg-white rounded-2xl overflow-hidden shadow-card flex flex-col">' +
      '<a href="' + url + '" tabindex="-1" aria-hidden="true" class="block">' +
        '<div class="thumb h-40" data-region="' + r.id + '"><div class="silhouette" data-region-silhouettes="' + r.id + '" style="gap:.25rem">' +
        r.provinceIds.slice(0, 3).map(function (id) { return '<div class="h-full" data-silhouette="' + esc(id) + '" style="height:100%;display:flex;align-items:center"></div>'; }).join('') +
        '</div></div></a>' +
      '<div class="p-5 flex flex-col gap-2 flex-1">' +
        '<h3 class="font-display text-2xl font-bold text-deep-700">' + esc(r.label) + '</h3>' +
        '<p class="text-sm text-gray-700 leading-relaxed">' + esc(r.description) + '</p>' +
        '<p class="text-xs text-gray-500">' + r.provinceIds.length + ' đơn vị cấp tỉnh · ' + names + '…</p>' +
        '<a href="' + url + '" class="btn-forest self-start mt-auto" style="margin-top:.75rem">Khám phá ' + esc(r.label.toLowerCase()) + ' ' + U.ICON.arrow + '</a>' +
      '</div></article>';
  }

  function init() {
    D.loadContext().then(function (ctx) {
      // Địa phương nổi bật
      var html = ctx.featuredIds.map(function (id) { return ctx.byId[id]; }).filter(Boolean).map(function (u) {
        return '<div class="reveal">' + U.provinceCard(u, ctx) + '</div>';
      }).join('');
      $('#featured-grid').html(html);

      // Vùng miền
      $('#region-rule').text(ctx.regionRule);
      $('#region-grid').html(ctx.regions.map(function (r) { return regionCard(r, ctx.byId); }).join(''));

      // Số liệu giới thiệu – tính từ dữ liệu thật
      var former = 0, places = 0, specs = 0;
      ctx.units.forEach(function (u) {
        former += u.formerUnits.length;
        places += u.searchNames.destinations.length;
        specs += u.searchNames.specialties.length;
      });
      function stat(n, label) {
        return '<li class="bg-white/10 rounded-2xl p-5"><p class="font-display text-4xl font-bold text-ochre-400">' + D.formatNumber(n, 0) + '</p><p class="text-sm mt-1">' + label + '</p></li>';
      }
      $('#about-stats').html(stat(ctx.units.length, 'đơn vị cấp tỉnh hiện hành') + stat(former, 'đơn vị tiền thân được kế thừa') + stat(places, 'địa điểm trong hồ sơ') + stat(specs, 'đặc sản trong hồ sơ'));

      U.hydrateSilhouettes($('#featured-grid, #region-grid'));
      U.observeReveal($(document));
    }).catch(function (err) {
      $('#featured-grid').html('<p class="col-span-full text-center text-crimson-700" role="alert">Không tải được dữ liệu: ' + esc(err.message) + '. Hãy chạy dự án bằng VS Code Live Server.</p>');
    });
  }

  $(init);
})(window, jQuery);

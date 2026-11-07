/* =========================================================
   auth.js – ĐĂNG NHẬP / ĐĂNG KÝ (MÔ PHỎNG phía trình duyệt)
   Kiểm tra biểu mẫu bằng jQuery. Tài khoản lưu trong localStorage
   (mật khẩu băm SHA-256 + muối khi trình duyệt hỗ trợ WebCrypto).
   KHÔNG phải xác thực thực tế: không có máy chủ, không bảo mật.
   Phụ thuộc: jQuery, data.js, main.js
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data;

  function bytesToHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  function hash(password, salt) {
    var data = new TextEncoder().encode(salt + ':' + password);
    if (global.crypto && global.crypto.subtle) {
      return global.crypto.subtle.digest('SHA-256', data).then(bytesToHex);
    }
    // Môi trường không an toàn (http không phải localhost): băm đơn giản, chỉ để mô phỏng
    var h = 5381; for (var i = 0; i < data.length; i++) { h = ((h << 5) + h + data[i]) >>> 0; }
    return Promise.resolve('weak-' + h.toString(16));
  }
  function randomSalt() {
    var a = new Uint8Array(8);
    if (global.crypto && global.crypto.getRandomValues) { global.crypto.getRandomValues(a); } else { for (var i = 0; i < 8; i++) { a[i] = Math.floor(Math.random() * 256); } }
    return bytesToHex(a);
  }

  /* ---------- Hiển thị lỗi ---------- */
  function setError(id, msg) {
    var $f = $('#' + id);
    $('[data-error-for="' + id + '"]').text(msg || '');
    $f.toggleClass('is-invalid', !!msg).attr('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  function clearErrors($form) {
    $form.find('.field').removeClass('is-invalid').removeAttr('aria-invalid');
    $form.find('.field-error').text('');
  }
  function status(msg, kind) {
    var $s = $('#auth-status');
    if (!msg) { $s.addClass('hidden'); return; }
    $s.removeClass('hidden bg-forest-100 text-forest-800 bg-crimson-50 text-crimson-700')
      .addClass(kind === 'ok' ? 'bg-forest-100 text-forest-800' : 'bg-crimson-50 text-crimson-700').text(msg);
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var USER_RE = /^[A-Za-z0-9_]{3,20}$/;

  /* ---------- Chuyển chế độ ---------- */
  function setMode(mode) {
    var reg = mode === 'register';
    $('#form-login').toggleClass('hidden', reg);
    $('#form-register').toggleClass('hidden', !reg);
    $('#form-forgot').addClass('hidden');
    $('.tab-btn[data-mode]').each(function () { $(this).attr('aria-selected', $(this).data('mode') === mode); });
    $('#auth-title').text(reg ? 'Tạo tài khoản' : 'Đăng nhập');
    document.title = (reg ? 'Đăng ký' : 'Đăng nhập') + ' – Viet Culture Map';
    status('');
  }
  function modeFromHash() { return global.location.hash === '#register' ? 'register' : 'login'; }

  function afterSuccess(user, remember) {
    D.session.set(user, remember);
    status('Xin chào ' + (user.fullName || user.username) + '! Đang chuyển về trang chủ…', 'ok');
    setTimeout(function () { global.location.href = 'index.html'; }, 900);
  }

  /* ---------- Xử lý biểu mẫu ---------- */
  function onLogin(e) {
    e.preventDefault();
    var $f = $('#form-login'); clearErrors($f);
    var id = $.trim($('#login-id').val()), pw = $('#login-password').val();
    var ok = setError('login-id', id ? '' : 'Vui lòng nhập email hoặc tên đăng nhập.');
    ok = setError('login-password', pw ? '' : 'Vui lòng nhập mật khẩu.') && ok;
    if (!ok) { return; }
    var key = id.toLowerCase();
    var user = D.session.users().filter(function (u) { return u.username.toLowerCase() === key || u.email.toLowerCase() === key; })[0];
    if (!user) { status('Không tìm thấy tài khoản. Hãy kiểm tra lại hoặc đăng ký mới.', 'err'); return; }
    hash(pw, user.salt).then(function (h) {
      if (h !== user.hash) { status('Mật khẩu không đúng.', 'err'); return; }
      afterSuccess(user, $('#login-remember').is(':checked'));
    });
  }

  function onRegister(e) {
    e.preventDefault();
    var $f = $('#form-register'); clearErrors($f);
    var name = $.trim($('#reg-name').val()), email = $.trim($('#reg-email').val()), username = $.trim($('#reg-username').val());
    var pw = $('#reg-password').val(), pw2 = $('#reg-password2').val();
    var users = D.session.users();
    var ok = true;
    ok = setError('reg-name', name.length >= 2 ? '' : 'Vui lòng nhập họ và tên (ít nhất 2 ký tự).') && ok;
    ok = setError('reg-email', !email ? 'Vui lòng nhập email.' : !EMAIL_RE.test(email) ? 'Email chưa đúng định dạng.'
      : users.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); }) ? 'Email này đã được đăng ký.' : '') && ok;
    ok = setError('reg-username', !username ? 'Vui lòng nhập tên đăng nhập.' : !USER_RE.test(username) ? 'Tên đăng nhập gồm 3–20 ký tự: chữ không dấu, số hoặc dấu gạch dưới.'
      : users.some(function (u) { return u.username.toLowerCase() === username.toLowerCase(); }) ? 'Tên đăng nhập đã tồn tại.' : '') && ok;
    ok = setError('reg-password', pw.length < 8 ? 'Mật khẩu cần tối thiểu 8 ký tự.' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Mật khẩu cần có cả chữ và số.' : '') && ok;
    ok = setError('reg-password2', !pw2 ? 'Vui lòng nhập lại mật khẩu.' : pw2 !== pw ? 'Mật khẩu nhập lại không khớp.' : '') && ok;
    ok = setError('reg-terms', $('#reg-terms').is(':checked') ? '' : 'Bạn cần đồng ý với điều khoản để tiếp tục.') && ok;
    if (!ok) { return; }
    var salt = randomSalt();
    hash(pw, salt).then(function (h) {
      var user = { fullName: name, email: email, username: username, salt: salt, hash: h, createdAt: new Date().toISOString() };
      users.push(user);
      try { D.session.saveUsers(users); } catch (err) { status('Không thể lưu tài khoản (trình duyệt chặn localStorage).', 'err'); return; }
      afterSuccess(user, true);
    });
  }

  function onForgot(e) {
    e.preventDefault();
    clearErrors($('#form-forgot'));
    var email = $.trim($('#forgot-email').val());
    if (!setError('forgot-email', !email ? 'Vui lòng nhập email.' : !EMAIL_RE.test(email) ? 'Email chưa đúng định dạng.' : '')) { return; }
    status('Đây là bản mô phỏng nên không có email nào được gửi. Với tài khoản lưu trong trình duyệt, bạn có thể đăng ký lại bằng tên đăng nhập khác.', 'ok');
  }

  $(function () {
    if (!$('#form-login').length) { return; }
    setMode(modeFromHash());
    $('.tab-btn[data-mode]').on('click', function () { var m = $(this).data('mode'); global.history.replaceState(null, '', '#' + m); setMode(m); });
    $('[data-switch]').on('click', function (e) { e.preventDefault(); var m = $(this).data('switch'); global.history.replaceState(null, '', '#' + m); setMode(m); });
    $(global).on('hashchange', function () { setMode(modeFromHash()); });
    $('#forgot-link').on('click', function () { $('#form-forgot').toggleClass('hidden'); $('#forgot-email').trigger('focus'); });
    $('#form-login').on('submit', onLogin);
    $('#form-register').on('submit', onRegister);
    $('#form-forgot').on('submit', onForgot);
    $('.field').on('input', function () { setError(this.id, ''); });
  });
})(window, jQuery);

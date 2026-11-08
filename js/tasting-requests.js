(function () {
  'use strict';
  var SB = window.SAMALBAKES;
  SB.tastingRequests = {
    formHtml: function () {
      return '<form id="tasting-request-form" style="margin-top:1rem">' +
        '<div class="field"><label for="tasting-business">Business name</label><input id="tasting-business" name="business_name" maxlength="200" autocomplete="organization" required /></div>' +
        '<div class="field"><label for="tasting-email">Email</label><input id="tasting-email" name="email" type="email" maxlength="254" autocomplete="email" required /></div>' +
        '<div class="field"><label for="tasting-phone">Phone number</label><input id="tasting-phone" name="phone" type="tel" maxlength="40" autocomplete="tel" required /></div>' +
        '<div class="request-honeypot" aria-hidden="true"><label>Leave blank<input name="website" tabindex="-1" autocomplete="off" /></label></div>' +
        '<p class="muted">We’ll use these details to contact you about this request and include them in an email alert to the bakery.</p>' +
        '<button type="submit" class="btn primary">Request a tasting box</button></form>' +
        '<p id="tasting-request-message" role="status" aria-live="polite" hidden></p>';
    },
    bind: function () {
      var form = document.querySelector('#tasting-request-form');
      if (!form) return;
      var button = form.querySelector('button');
      var message = document.querySelector('#tasting-request-message');
      var pending = null;
      form.onsubmit = async function (event) {
        event.preventDefault();
        if (button.disabled || !form.reportValidity()) return;
        var fields = {business_name:form.elements.business_name.value.trim(),email:form.elements.email.value.trim(),phone:form.elements.phone.value.trim(),website:form.elements.website.value};
        var signature = JSON.stringify(fields);
        try { if (!pending) pending = JSON.parse(sessionStorage.getItem('sb_tasting_pending') || 'null'); } catch (_) {}
        if (!pending || pending.signature !== signature) pending = {id:crypto.randomUUID(),signature:signature};
        try { sessionStorage.setItem('sb_tasting_pending', JSON.stringify(pending)); } catch (_) {}
        button.disabled = true; button.textContent = 'Sending request…';
        message.hidden = true;
        try {
          await SB.data.requestTastingBox(Object.assign({id:pending.id},fields));
          form.hidden = true;
          message.className = 'msg ok';
          message.textContent = 'Request received—we’ll contact you to arrange your tasting box. Subject to availability and bakery approval.';
          try { sessionStorage.removeItem('sb_tasting_pending'); } catch (_) {}
        } catch (err) {
          message.className = 'msg warn'; message.textContent = err.message || 'Could not send your request. Please try again.';
          button.disabled = false; button.textContent = 'Request a tasting box';
        }
        message.hidden = false;
      };
    }
  };
})();

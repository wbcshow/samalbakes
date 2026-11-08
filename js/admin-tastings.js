(function () {
  'use strict';
  var SB = window.SAMALBAKES;
  SB.adminTastings = {init: function () {
    var list = document.querySelector('#tasting-requests');
    var message = document.querySelector('#tasting-admin-message');
    var refresh = document.querySelector('#refresh-tastings');
    var offset = 0;
    var next = document.querySelector('#next-tastings');
    var previous = document.querySelector('#previous-tastings');
    function report(text) { message.hidden = false; message.className = 'msg warn'; message.textContent = text; }
    async function load() {
      refresh.disabled = true; next.disabled = true; previous.disabled = true;
      message.hidden = true;
      try {
        var rows = await SB.data.getTastingRequests(offset);
        list.replaceChildren();
        if (!rows.length) list.textContent = 'No tasting box requests on this page.';
        rows.forEach(function (request) {
          var card = document.createElement('article'); card.className = 'card';
          var title = document.createElement('h3'); title.textContent = request.business_name;
          var contact = document.createElement('p'); contact.textContent = request.email + ' · ' + request.phone;
          var date = document.createElement('p'); date.className = 'muted';
          date.textContent = new Date(request.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}) + ' (Philippine time)';
          var notification = (request.order_email_outbox || [])[0];
          var email = document.createElement('p'); email.className = 'muted';
          var labels = {pending:'Waiting to send',sending:'Sending',accepted:'Accepted by email service',failed:'Needs attention',cancelled:'Cancelled'};
          email.textContent = 'Bakery email alert: ' + (notification ? labels[notification.state] || notification.state : 'Not queued (email alerts were off)');
          var label = document.createElement('label'); label.textContent = 'Request status ';
          var status = document.createElement('select'); status.setAttribute('aria-label','Status for ' + request.business_name);
          ['new','contacted','approved','declined'].forEach(function (value) {
            var option = document.createElement('option'); option.value = value; option.textContent = value.charAt(0).toUpperCase() + value.slice(1); status.append(option);
          });
          status.value = request.status;
          var feedback = document.createElement('p'); feedback.setAttribute('role','status'); feedback.hidden = true;
          status.onchange = async function () {
            var selected = status.value; status.disabled = true;
            try { await SB.data.updateTastingStatus(request.id,selected); request.status = selected; feedback.textContent = 'Status saved.'; feedback.className = 'msg ok'; }
            catch (err) { status.value = request.status; feedback.textContent = err.message; feedback.className = 'msg warn'; }
            finally { status.disabled = false; feedback.hidden = false; }
          };
          label.append(status); card.append(title,contact,date,email,label,feedback); list.append(card);
        });
        next.disabled = rows.length < 50; previous.disabled = offset === 0;
      } catch (err) { report(err.message); previous.disabled = offset === 0; }
      finally { refresh.disabled = false; }
    }
    refresh.onclick = load;
    next.onclick = function () { offset += 50; return load(); };
    previous.onclick = function () { offset = Math.max(0,offset-50); return load(); };
    return load();
  }};
})();

(function () {
  'use strict';
  var SB = window.SAMALBAKES;
  SB.adminPartners = { init: async function () {
    var form = document.querySelector('#partner-form');
    var list = document.querySelector('#partner-list');
    var message = document.querySelector('#partner-message');
    function report(text, error) {
      message.textContent = text;
      message.className = 'msg ' + (error ? 'warn' : 'ok');
      message.hidden = false;
    }
    async function load() {
      var rows = await SB.data.getResortPartners();
      list.replaceChildren();
      if (!rows.length) { list.textContent = 'No resort partners approved yet.'; return; }
      rows.forEach(function (partner) {
        var row = document.createElement('div');
        row.className = 'card';
        var title = document.createElement('p');
        title.textContent = partner.resort_name + ' · ' + partner.email + ' · ' + (partner.active ? 'Approved' : 'Inactive');
        var button = document.createElement('button');
        button.type = 'button'; button.className = 'btn ghost';
        button.textContent = partner.active ? 'Deactivate' : 'Reactivate';
        button.onclick = async function () {
          button.disabled = true;
          try {
            await SB.data.saveResortPartner(partner.email, partner.resort_name, !partner.active);
            report(partner.active ? 'Partner deactivated. Future RESORT50 orders are blocked.' : 'Partner approved.');
            await load();
          } catch (err) { report(err.message, true); button.disabled = false; }
        };
        row.append(title, button); list.append(row);
      });
    }
    form.onsubmit = async function (event) {
      event.preventDefault();
      var button = form.querySelector('button'); button.disabled = true;
      try {
        await SB.data.saveResortPartner(form.elements.partner_email.value, form.elements.resort_name.value, true);
        form.reset(); report('Partner approved. They can use RESORT50 on every order meeting the saved minimum.');
        await load();
      } catch (err) { report(err.message, true); }
      finally { button.disabled = false; }
    };
    try { await load(); } catch (err) { report(err.message, true); }
  }};
})();

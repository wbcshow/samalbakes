(function () {
  "use strict";
  var SB = window.SAMALBAKES;
  SB.adminOrderEmail = { init: async function () {
    var form = document.getElementById("order-email-form");
    var connection = document.getElementById("order-email-connection");
    var save = document.getElementById("order-email-save");
    var enabled = document.getElementById("order-email-enabled");
    var recipient = document.getElementById("order-email-recipient");
    var sender = document.getElementById("order-email-sender");
    var message = document.getElementById("order-email-message");
    if (SB.data.isDemo) { connection.textContent = "Automatic email alerts require the live site."; return; }
    var client = SB.data.backend.client;
    var ready = false;
    function feedback(text, ok) { message.style.display = "block"; message.className = "msg " + (ok ? "ok" : "warn"); message.textContent = text; }
    async function load() {
      var results = await Promise.all([
        client.from("order_email_settings").select("*").eq("id",1).single(),
        client.rpc("order_email_ready"),
        client.from("order_email_outbox").select("order_id,tasting_request_id,state,created_at,detail").order("created_at",{ascending:false}).limit(5)
      ]);
      results.forEach(function (r) { if (r.error) throw new Error(r.error.message); });
      var config = results[0].data;
      recipient.value = config.recipient; sender.value = config.sender; enabled.checked = config.enabled;
      ready = results[1].data === true;
      connection.textContent = ready ? "Sending key connected. Confirm the sending domain is verified before enabling alerts." : "Setup incomplete: connect the email sending key and verify the sending domain before enabling alerts.";
      var labels = {pending:"Waiting to send",sending:"Sending",accepted:"Accepted by email service",failed:"Needs attention",cancelled:"Cancelled"};
      var rows = results[2].data || [];
      document.getElementById("order-email-history").innerHTML = rows.length ? '<h3>Recent email alerts</h3><ul>' + rows.map(function (row) {
        return '<li>' + SB.chrome.escapeHtml((row.tasting_request_id ? 'Tasting request ' + String(row.tasting_request_id).slice(0,8) : String(row.order_id).slice(0,8))) + ': ' + SB.chrome.escapeHtml(labels[row.state] || row.state) + (row.detail ? ' — ' + SB.chrome.escapeHtml(row.detail) : '') + '</li>';
      }).join('') + '</ul>' : '<p class="muted">No email alerts yet. New orders and tasting requests generate emails while alerts are enabled.</p>';
      save.disabled = false;
    }
    form.onsubmit = async function (event) {
      event.preventDefault();
      if (enabled.checked && !ready) { feedback("Connect the sending service before enabling email alerts.",false); return; }
      save.disabled = true;
      try {
        var result = await client.from("order_email_settings").update({recipient:recipient.value.trim(),sender:sender.value.trim(),enabled:enabled.checked}).eq("id",1).select().single();
        if (result.error) throw new Error(result.error.message);
        feedback(result.data.enabled ? "Email alerts enabled for new orders and tasting requests." : "Email alert settings saved. Sending is off.",true);
      } catch (error) { feedback(error.message || "Could not save email alert settings.",false); }
      finally { save.disabled = false; }
    };
    try { await load(); } catch (error) { connection.textContent = "Email alert setup is unavailable: " + error.message; }
  }};
})();

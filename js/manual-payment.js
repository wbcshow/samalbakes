(function(){
  'use strict';
  var SB=window.SAMALBAKES;
  function escape(value){return SB.chrome.escapeHtml(String(value));}
  SB.manualPayment={
    label:function(order){return order.payment_method==='gcash' ? 'GCash — '+(order.payment_status==='paid'?'paid':'awaiting payment verification') : 'Cash on Delivery (COD)';},
    instructions:function(order,peso){
      return '<section class="gcash-instructions" aria-label="GCash payment instructions"><h3>Pay now with GCash</h3>'+
        '<p>Amount to pay: <strong>'+escape(peso(order.total))+'</strong><br>Recipient: <strong>Annie Joy Pungasi</strong><br>Order reference: <strong>'+escape(String(order.id).slice(0,8))+'</strong></p>'+
        '<img class="gcash-qr" src="assets/gcash-qr.jpeg" alt="GCash payment QR code for Annie Joy Pungasi" width="828" height="1608">'+
        '<p><a href="assets/gcash-qr.jpeg" download="SamalBakes-GCash.jpeg">Save payment QR code</a> · <a href="assets/gcash-qr.jpeg" target="_blank" rel="noopener">Open full-size QR code</a></p>'+
        '<ol><li>Scan this code in GCash, or save it and select the image using the QR scanner in GCash on this phone.</li><li>Check the recipient matches Annie Joy Pungasi (GCash may mask parts of the name). Enter the exact amount above and confirm payment. Transfer fees may apply.</li><li>Keep your GCash receipt. <a href="contact.html">Contact the bakery</a> with your order reference and GCash transaction reference so Annie can match your payment.</li></ol>'+
        '<p class="msg info">Awaiting payment verification. Annie will check that payment arrived and mark your order paid. If you have already paid, do not pay again while waiting.</p></section>';
    },
    adminCard:function(order){
      if(order.payment_method!=='gcash')return '';
      return '<div class="gcash-admin"><p><strong>'+escape(SB.manualPayment.label(order))+'</strong></p>'+
        (order.payment_status==='paid' ? '<p class="muted">Verified: '+escape(order.payment_verified_at||'')+'</p>' :
          '<p>Check the actual GCash transaction, amount and customer before marking paid. A screenshot alone is not verification.</p><button type="button" class="btn" data-verify-gcash="'+escape(order.id)+'">I verified the GCash payment — mark paid</button>')+'</div>';
    },
    bindAdmin:function(container,orders,refresh){
      if(container._gcashHandler)container.removeEventListener('click',container._gcashHandler);
      container._gcashHandler=async function(event){
        var button=event.target.closest('[data-verify-gcash]');if(!button||button.disabled)return;
        var id=button.getAttribute('data-verify-gcash'),order=orders.find(function(o){return String(o.id)===id;});
        var card=button.closest('article'),message=card.querySelector('[data-order-status-message]');
        var controls=card.querySelectorAll('button,input,select');controls.forEach(function(c){c.disabled=true;});
        message.hidden=false;message.className='msg info';message.textContent='Saving payment verification…';
        try{await SB.data.verifyGcashPayment(id,order.updated_at);await refresh();}
        catch(error){message.className='msg warn';message.textContent='Payment was not marked paid. '+(error.message||'Please retry.');}
        finally{controls.forEach(function(c){c.disabled=false;});}
      };
      container.addEventListener('click',container._gcashHandler);
    }
  };
})();

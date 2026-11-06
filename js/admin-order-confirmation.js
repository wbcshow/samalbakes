(function(){
  "use strict";
  var SB=window.SAMALBAKES;
  SB.adminOrderConfirmation={
    render:function(order,format){
      var escape=SB.chrome.escapeHtml;
      var html='<p class="muted">Original estimate: '+escape(format(order.estimated_ready_at))+'</p>';
      if(order.confirmed_ready_at)html+='<p><strong>Confirmed ready: '+escape(format(order.confirmed_ready_at))+'</strong></p>';
      if(order.status==='delivered'||order.status==='cancelled')return html;
      var suffix=escape(order.id);
      var date=SB.orderConfirmation.localInput(order.confirmed_ready_at||order.estimated_ready_at);
      return html+'<div class="field"><label for="ready-'+suffix+'">Confirmed ready date and time (Philippine time)</label>'+ 
        '<input id="ready-'+suffix+'" data-confirm-ready type="datetime-local" value="'+escape(date)+'" required /></div>'+
        '<div class="field"><label for="ready-note-'+suffix+'">Note to customer (optional)</label><input id="ready-note-'+suffix+'" data-confirm-note maxlength="1000" value="'+escape(order.confirmed_ready_note||'')+'" placeholder="e.g. Additional cooling time needed" /></div>'+
        '<button type="button" class="btn primary" data-confirm-order="'+suffix+'">'+(order.status==='new'?'Accept and confirm time':'Save revised ready time')+'</button>'+
        '<p class="muted">'+(order.guest_email?'A customer email will be queued if email alerts are enabled.':'No customer email was supplied. Contact the customer by phone to confirm the time.')+'</p>';
    },
    bind:function(container,orders,refresh){
      container.onclick=async function(event){
        var button=event.target.closest('[data-confirm-order]');
        if(!button||button.disabled)return;
        var id=button.getAttribute('data-confirm-order');
        var order=orders.find(function(o){return String(o.id)===id;});
        var card=button.closest('article');
        var msg=card.querySelector('[data-order-status-message]');
        var controls=card.querySelectorAll('input,select,button');
        function feedback(text,kind){msg.hidden=false;msg.className='msg '+kind;msg.textContent=text;}
        try{
          var readyAt=SB.orderConfirmation.utcInput(card.querySelector('[data-confirm-ready]').value);
          var note=card.querySelector('[data-confirm-note]').value.trim();
          controls.forEach(function(c){c.disabled=true;});
          feedback('Saving confirmation…','info');
          var result=await SB.data.confirmOrder(id,readyAt,note,order.updated_at);
          await refresh();
          var fresh=document.getElementById('order-'+id);
          if(fresh){
            var message=fresh.querySelector('[data-order-status-message]');
            message.hidden=false;message.className='msg ok';
            message.textContent=order.status==='new'?'Order accepted and ready time confirmed.':'Confirmed ready time updated.';
            if(result.customer_email_queued)message.textContent+=' Customer email queued.';
            else message.textContent+=' No customer email was queued; contact the customer directly if needed.';
          }
        }catch(error){feedback(error.message||'Could not save the confirmation.','warn');}
        finally{controls.forEach(function(c){c.disabled=false;});}
      };
    }
  };
})();

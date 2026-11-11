(function(){
  "use strict";
  var SB=window.SAMALBAKES;
  SB.initCheckoutFlow=function(refresh){
    if(SB.initDeliveryMethodTabs)SB.initDeliveryMethodTabs();
    var current=1, complete=false;
    var root=document.getElementById('order-filled');
    var message=document.getElementById('checkout-stage-message');
    var header=document.querySelector('.site-header');
    var progress=document.getElementById('checkout-progress-sticky');
    function measureProgress(){
      if(header&&header.getBoundingClientRect().height)document.documentElement.style.setProperty('--checkout-header-height',header.getBoundingClientRect().height+'px');
      if(progress&&progress.getBoundingClientRect().height)document.documentElement.style.setProperty('--checkout-progress-height',progress.getBoundingClientRect().height+'px');
    }
    if(typeof ResizeObserver!=='undefined'){
      var progressObserver=new ResizeObserver(measureProgress);
      if(header)progressObserver.observe(header);
      if(progress)progressObserver.observe(progress);
    }
    window.addEventListener('resize',measureProgress);
    measureProgress();
    function value(id){var field=document.getElementById(id);return field?field.value.trim():'';}
    function contactError(){
      if(!value('guest-name'))return 'Enter your name to continue.';
      if(!value('guest-phone'))return 'Enter a phone number so we can contact you about delivery.';
      var email=document.getElementById('guest-email');
      if(!email.checkValidity())return 'Enter a valid email address, or leave email blank.';
      return '';
    }
    function deliveryError(){return SB.checkoutPin&&SB.checkoutPin.confirmed&&SB.checkoutPin.inZone?'':'Choose a delivery pin inside our delivery area and select Deliver here.';}
    function show(stage,focus){
      current=stage;message.hidden=true;
      root.querySelectorAll('[data-checkout-stage]').forEach(function(panel){panel.hidden=Number(panel.getAttribute('data-checkout-stage'))!==stage;});
      root.querySelectorAll('.checkout-steps li').forEach(function(item,index){
        item.classList.toggle('is-complete',index+1<stage);
        item.querySelector('span').textContent=index+1<stage?'\u2713':String(index+1);
        item.setAttribute('aria-label',['Bag','Delivery','Contact','Review'][index]+(index+1<stage?', completed':index+1===stage?', current step':', upcoming'));
        if(index+1===stage)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
      });
      document.getElementById('checkout-step-caption').textContent='Step '+stage+' of 4 — '+['Bag','Delivery','Contact','Review'][stage-1];
      document.getElementById('checkout-progress').value=stage;
      if(stage===2&&SB.checkoutPin&&SB.checkoutPin.resize)requestAnimationFrame(SB.checkoutPin.resize);
      if(focus){var title=root.querySelector('[data-checkout-stage="'+stage+'"] h2');title.focus();title.scrollIntoView({behavior:'smooth',block:'start'});}
    }
    function warn(text){message.textContent=text;message.hidden=false;message.scrollIntoView({behavior:'smooth',block:'center'});}
    root.querySelectorAll('[data-checkout-next]').forEach(function(button){button.onclick=function(){
      var error=current===1?(!document.querySelector('#cart-lines li')?'Add an item to your bag first.':''):current===2?deliveryError():contactError();
      if(error){warn(error);return;}
      refresh();show(Math.min(4,current+1),true);
    };});
    root.querySelectorAll('[data-checkout-back]').forEach(function(button){button.onclick=function(){if(!SB.checkoutFlow.submitting)show(Math.max(1,current-1),true);};});
    SB.checkoutFlow={
      submitting:false,
      contactError:contactError,
      setSubmitting:function(value){
        SB.checkoutFlow.submitting=value;
        root.querySelectorAll('[data-checkout-stage="4"] button,[data-checkout-stage="4"] input,[data-checkout-stage="4"] select').forEach(function(control){control.disabled=value;});
      },
      validate:function(){
        var delivery=deliveryError();if(delivery){show(2,true);warn(delivery);return false;}
        var contact=contactError();if(contact){show(3,true);warn(contact);return false;}
        return current===4&&!complete;
      },
      update:function(lines,peso){
        var items=document.getElementById('checkout-review-items');items.replaceChildren();
        lines.forEach(function(line){var li=document.createElement('li');li.className='cart-line';li.textContent=line.product.name+' × '+line.qty+' — '+peso(line.product.price*line.qty);items.appendChild(li);});
        document.getElementById('checkout-review-contact').textContent=[value('guest-name'),value('guest-phone'),value('guest-email')].filter(Boolean).join(' · ');
        document.getElementById('checkout-review-address').textContent=value('guest-address')||'Delivery to your confirmed map pin';
        document.getElementById('checkout-review-notes').textContent=value('guest-notes');
        var mapLink=document.getElementById('checkout-review-map');
        mapLink.hidden=!(SB.checkoutPin&&SB.checkoutPin.confirmed);if(!mapLink.hidden)mapLink.href=SB.checkoutPin.url;
      },
      complete:function(){
        complete=true;root.hidden=true;document.getElementById('cart-empty').hidden=true;
        var success=document.getElementById('checkout-success');success.hidden=false;
        document.getElementById('checkout-receipt').appendChild(document.getElementById('place-order-msg'));
        var title=success.querySelector('h2');title.focus();title.scrollIntoView({behavior:'smooth',block:'start'});
      }
    };
    show(1,false);
  };
})();

(function(){
  "use strict";
  var SB=window.SAMALBAKES;
  SB.initDeliveryMethodTabs=function(){
    var tabs=Array.from(document.querySelectorAll('[data-delivery-method]'));
    if(!tabs.length)return;
    function activate(tab,focus){
      tabs.forEach(function(item){
        var active=item===tab;
        item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;
        document.getElementById(item.getAttribute('aria-controls')).hidden=!active;
      });
      var method=tab.getAttribute('data-delivery-method');
      document.getElementById('checkout-center').hidden=method!=='pin';
      document.getElementById('checkout-confirm').hidden=method==='location';
      document.getElementById('pin-help').textContent=method==='location'?'Your device location is used automatically. The pin is locked on this tab. To choose a different delivery spot, use Search address or Place a pin.':'Check your delivery pin and select Deliver here to confirm it. You can drag the pin to adjust it. The shaded circle shows our delivery area.';
      if(SB.checkoutPin){
        if(SB.checkoutPin.setMethod)SB.checkoutPin.setMethod(method);
        else if(SB.checkoutPin.cancelLookup)SB.checkoutPin.cancelLookup();
        if(SB.checkoutPin.resize)requestAnimationFrame(SB.checkoutPin.resize);
      }
      if(focus)tab.focus();
    }
    tabs.forEach(function(tab,index){
      tab.onclick=function(){activate(tab,false);};
      tab.onkeydown=function(event){
        var next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
        if(next<0)return;event.preventDefault();activate(tabs[next],true);
      };
    });
    activate(tabs[0],false);
  };
})();

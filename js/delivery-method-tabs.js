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
      document.getElementById('checkout-center').hidden=tab.getAttribute('data-delivery-method')!=='pin';
      if(SB.checkoutPin){
        if(SB.checkoutPin.cancelLookup)SB.checkoutPin.cancelLookup();
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

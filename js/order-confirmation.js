(function(root,factory){
  var helpers=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=helpers;
  else root.SAMALBAKES.orderConfirmation=helpers;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  function localInput(instant){
    if(!instant)return "";
    var date=new Date(instant);
    if(!Number.isFinite(date.getTime()))return "";
    // The Philippines uses UTC+08:00 throughout the year.
    return new Date(date.getTime()+8*3600000).toISOString().slice(0,16);
  }
  function utcInput(value){
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||""))throw new Error("Choose a ready date and time in Philippine time.");
    var date=new Date(value+":00+08:00");
    if(!Number.isFinite(date.getTime())||localInput(date)!==value)throw new Error("Choose a valid ready date and time.");
    if(date.getTime()<=Date.now())throw new Error("The confirmed ready time must be in the future.");
    return date.toISOString();
  }
  function historyLabel(order,format){
    return order.confirmed_ready_at ? "Confirmed ready: "+format(order.confirmed_ready_at) : "Ready est.: "+format(order.estimated_ready_at);
  }
  return {localInput:localInput,utcInput:utcInput,historyLabel:historyLabel};
});

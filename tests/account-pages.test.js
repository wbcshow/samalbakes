const {JSDOM}=require('../.review-tools/ui/node_modules/jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
async function page(file,script,session,hash=''){
  const dom=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'outside-only',url:'https://samalbakes.com/'+file});
  const w=dom.window;let start,fetches=0,inits=0;
  const add=w.document.addEventListener.bind(w.document);
  w.document.addEventListener=(name,fn,...args)=>name==='DOMContentLoaded'?start=fn:add(name,fn,...args);
  w.testLocation={hash,href:'',replace(value){this.href=value;}};
  w.SAMALBAKES={config:{timezone:'Asia/Manila'},chrome:{boot:async()=>{},refreshAuthNav:async()=>{},escapeHtml:s=>String(s).replace(/</g,'&lt;')},data:{isDemo:false,init:async()=>{inits++},getSession:async()=>session,login:async()=>{},getMyOrders:async()=>{fetches++;return [{created_at:'2026-11-06T13:28:00Z',status:'accepted',total:850,confirmed_ready_at:'2026-11-08T03:15:00Z',estimated_ready_at:'2026-11-07T03:15:00Z',confirmed_ready_note:'Extra cooling',items:[]}];}}};
  w.eval(fs.readFileSync('js/order-confirmation.js','utf8'));
  w.eval(fs.readFileSync('js/manual-payment.js','utf8'));
  w.eval(fs.readFileSync(script,'utf8').replace(/\blocation\./g,'testLocation.'));
  await start();
  return {dom,w,fetches:()=>fetches,inits:()=>inits};
}
(async()=>{
  const customer={user:{email:'customer@example.test',full_name:'Customer',is_admin:false}};
  let p=await page('account.html','js/account.js',customer);
  assert.equal(p.w.document.getElementById('history'),null);assert.equal(p.fetches(),0);assert.equal(p.w.document.getElementById('profile').hidden,false);
  p.w.document.getElementById('login-form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));await new Promise(setImmediate);
  assert.equal(p.w.testLocation.href,'index.html');p.dom.window.close();
  p=await page('account.html','js/account.js',{user:{email:'admin@example.test',is_admin:true}});
  p.w.document.getElementById('login-form').dispatchEvent(new p.w.Event('submit',{cancelable:true}));await new Promise(setImmediate);
  assert.equal(p.w.testLocation.href,'admin.html');p.dom.window.close();
  p=await page('account.html','js/account.js',customer,'#history');assert.equal(p.w.testLocation.href,'my-orders.html');assert.equal(p.inits(),0);p.dom.window.close();
  p=await page('my-orders.html','js/my-orders.js',customer);
  assert.equal(p.fetches(),1);assert.equal(p.w.document.getElementById('profile-form'),null);
  assert.match(p.w.document.getElementById('history-list').textContent,/Ordered on:.*accepted.*Confirmed ready:.*Original estimate:.*Extra cooling/s);p.dom.window.close();
  p=await page('my-orders.html','js/my-orders.js',null);
  assert.equal(p.fetches(),0);assert.equal(p.w.document.getElementById('orders-login').hidden,false);assert.equal(p.w.document.getElementById('history').hidden,true);p.dom.window.close();
  console.log('Separate account/orders pages, customer-home/admin-dashboard login routes, legacy redirects, confirmed history and signed-out gating pass.');
})().catch(e=>{console.error(e);process.exitCode=1;});

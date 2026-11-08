const {JSDOM}=require('../.review-tools/ui/node_modules/jsdom');
const fs=require('fs'),assert=require('node:assert/strict');
async function setup(cart) {
 const dom=new JSDOM(fs.readFileSync('order.html','utf8'),{runScripts:'outside-only',url:'https://samalbakes.com/order.html'}),w=dom.window,d=w.document;
 let start,resolve,reject;const add=d.addEventListener.bind(d);
 d.addEventListener=(name,fn,...args)=>name==='DOMContentLoaded'?start=fn:add(name,fn,...args);
 for(const f of ['config','product-sizes','ready-time'])w.eval(fs.readFileSync('js/'+f+'.js','utf8'));
 const SB=w.SAMALBAKES;SB.products=[{id:'cake',name:'Test cake',price:450,bakeTimeMinutes:60,prepMinutes:0,slots:1,active:true}];SB.promos=[];
 SB.chrome={boot:async()=>{},refreshCartBadge:()=>{},escapeHtml:require('../js/chrome').escapeHtml};
 SB.data={init:()=>new Promise((yes,no)=>{resolve=yes;reject=no;}),getSettings:async()=>({delivery_fee_type:'flat',delivery_fee_flat:80,free_delivery_min_order:1500}),getSession:async()=>null,calcDiscount:()=>0,calcDeliveryFee:()=>80};
 w.localStorage.setItem('sb_cart',JSON.stringify(cart));w.eval(fs.readFileSync('js/app.js','utf8'));
 assert.equal(d.querySelector('#cart-loading').hidden,false,'Loading is visible before JavaScript initializes');
 assert.equal(d.querySelector('#cart-empty').hidden,true);assert.equal(d.querySelector('#order-filled').hidden,true);
 const pending=start();
 assert.equal(d.querySelector('#cart-loading').hidden,false,'Loading remains visible while data is pending');
 assert.equal(d.querySelector('#cart-empty').hidden,true,'No misleading empty state during network delay');
 return {dom,w,d,pending,resolve,reject};
}
(async()=>{
 let s=await setup({cake:2});s.resolve();await s.pending;
 assert.equal(s.d.querySelector('#cart-loading').hidden,true);assert.equal(s.d.querySelector('#cart-empty').hidden,true);
 assert.equal(s.d.querySelector('#order-filled').hidden,false);assert.match(s.d.querySelector('#cart-lines').textContent,/Test cake/);s.dom.window.close();
 s=await setup({});s.resolve();await s.pending;
 assert.equal(s.d.querySelector('#cart-loading').hidden,true);assert.equal(s.d.querySelector('#cart-empty').hidden,false);s.dom.window.close();
 s=await setup({cake:2});s.reject(new Error('Network unavailable'));await s.pending;
 assert.match(s.d.querySelector('#cart-loading').textContent,/couldn’t load/);assert.equal(s.d.querySelector('#cart-retry').hidden,false);
 assert.equal(s.d.querySelector('#cart-empty').hidden,true);assert.equal(s.w.localStorage.getItem('sb_cart'),JSON.stringify({cake:2}));s.dom.window.close();
 console.log('Bag initial loading, slow initialization, filled/empty transitions and retry without cart loss passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

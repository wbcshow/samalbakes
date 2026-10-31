const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
function setup(history=[]) {
 const store=new Map([['sb_demo_orders',JSON.stringify(history)]]);
 const ctx=vm.createContext({window:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},console});
 for(const file of ['config','products','data']) vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),ctx);
 return {api:ctx.window.SAMALBAKES.data,store};
}
(async()=>{
 let {api,store}=setup();
 await api.init();
 const products=await api.getProducts(false);
 const base={items:[{product_id:products[0].id,qty:1}],guest_email:'new@example.com',guest_phone:'0915 294 3883',promo_code:'SAMALWELCOME',distance_km:2};
 const first=await api.placeOrder(base);
 assert(first.discount>0);
 await assert.rejects(api.placeOrder({...base,guest_email:' NEW@EXAMPLE.COM ',guest_phone:''}),/first orders only/);
 for(const phone of ['+63 915 294 3883','639152943883','9152943883','00639152943883']) {
  await assert.rejects(api.placeOrder({...base,guest_email:'other@example.com',guest_phone:phone}),/first orders only/);
 }
 await assert.rejects(api.placeOrder({...base,guest_email:'',guest_phone:''}),/Enter an email or phone/);
 await assert.rejects(api.placeOrder({...base,guest_email:'else@example.com',guest_phone:'',distance_km:10000}),/outside our delivery area/);
 const other=await api.placeOrder({...base,guest_email:'other@example.com',guest_phone:''});
 assert(other.discount>0);
 await api.placeOrder({...base,promo_code:null});
 const before=JSON.parse(store.get('sb_demo_orders')).length;
 await assert.rejects(api.placeOrder(base),/first orders only/);
 assert.equal(JSON.parse(store.get('sb_demo_orders')).length,before);
 // Any earlier order disqualifies a customer, even if it had no promo and was cancelled.
 ({api}=setup([{guest_email:'old@example.com',status:'cancelled'}]));
 await api.init();
 await assert.rejects(api.placeOrder({...base,guest_email:'old@example.com',guest_phone:''}),/first orders only/);
 console.log('Welcome promotion: all assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1});

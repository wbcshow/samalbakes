const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const store=new Map();const context=vm.createContext({window:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},console});
for(const file of ['config','products','data'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8'),context);
(async()=>{
 const sb=context.window.SAMALBAKES;await sb.data.init();const original=await sb.data.getSettings();
 let response,updated,filter;
 const client={from:table=>{
  assert(['settings','products'].includes(table));
  const q={select(){return q},eq(k,v){filter=[k,v];return q},order(){return q},single:async()=>({data:original}),update(p){updated=p;return q},upsert(){throw Error('Settings must update the existing row instead of inserting')},maybeSingle:async()=>response,then(resolve){resolve({data:[]})}};return q;
 }};
 context.window.supabase={createClient:()=>client};sb.isDemoMode=()=>false;sb.supabaseConfig={url:'test',anonKey:'test'};await sb.data.init();
 const ids=['new-cake','chiffon','drip'];response={data:{...original,featured_product_ids:ids}};
 await sb.data.saveSettings({featured_product_ids:ids});assert.deepEqual(filter,['id',1]);assert.deepEqual(Array.from(updated.featured_product_ids),ids);assert.equal(updated.id,1);assert.deepEqual(Array.from(sb.config.featuredProductIds),ids);
 response={data:null};await assert.rejects(sb.data.saveSettings({featured_product_ids:null}),/logged in as an admin/);assert.deepEqual(Array.from(sb.config.featuredProductIds),ids);
 response={error:{message:'Database unavailable'}};await assert.rejects(sb.data.saveSettings({featured_product_ids:null}),/Database unavailable/);
 console.log('Remote settings save: updates singleton row, preserves chosen photos, and reports denied/missing rows and database errors.');
})().catch(e=>{console.error(e);process.exitCode=1});

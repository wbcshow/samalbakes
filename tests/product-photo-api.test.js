const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const store=new Map(),calls=[];
const ctx=vm.createContext({window:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},console});
for(const name of ['config','products','product-photo','data'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+name+'.js'),'utf8'),ctx);
(async()=>{
 const sb=ctx.window.SAMALBAKES;await sb.data.init();const settings=await sb.data.getSettings();
 let admin=true,uploadError=null;
 const storage={upload:async(p,f,o)=>{calls.push({p,f,o});return {error:uploadError}},getPublicUrl:p=>({data:{publicUrl:'https://example.test/'+p}})};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'admin-id',email:'test@example.test'}}}})},storage:{from:bucket=>{assert.equal(bucket,'product-photos');return storage}},from:table=>{const q={eq(){return q},order(){return q},select(){return q},single:async()=>({data:settings}),maybeSingle:async()=>({data:{is_admin:admin}}),then(resolve){resolve({data:[]})}};return q}};
 sb.isDemoMode=()=>false;ctx.window.supabase={createClient:()=>client};sb.supabaseConfig={url:'https://example.test',anonKey:'test'};await sb.data.init();
 const file={type:'image/jpeg',size:1024,name:'../../unsafe.svg'};
 const url=await sb.data.uploadProductPhoto(file);assert.match(url,/admin-id\/[a-f0-9-]+\.jpg$/);assert.equal(calls[0].o.upsert,false);assert.equal(calls[0].o.contentType,'image/jpeg');
 await sb.data.uploadProductPhoto(file);assert.notEqual(calls[0].p,calls[1].p);
 admin=false;await assert.rejects(sb.data.uploadProductPhoto(file),/admin/);assert.equal(calls.length,2);
 admin=true;uploadError={message:'Storage unavailable'};await assert.rejects(sb.data.uploadProductPhoto(file),/Photo upload failed.*Storage unavailable/);
 const count=calls.length;await assert.rejects(sb.data.uploadProductPhoto({type:'image/svg+xml',size:10}),/JPG/);assert.equal(calls.length,count);
 console.log('Photo upload API: safe unique filenames, no overwrites, admin gate, storage errors, and invalid-file rejection passed.');
})().catch(e=>{console.error(e);process.exitCode=1});

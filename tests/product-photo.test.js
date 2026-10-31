const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const photo = require('../js/product-photo');
const root = path.join(__dirname, '..');
const file = { type: 'image/jpeg', size: 1024, name: 'cake.jpg' };
function element(value='') { return {value,hidden:false,style:{},listeners:{},addEventListener(n,fn){this.listeners[n]=fn;}}; }
async function editor() {
 const fields=Object.fromEntries(['name','category','price','description','image_url','bake_time_minutes','active'].map(n=>[n,element()]));
 fields.name.value='Test cake'; fields.price.value='150'; fields.bake_time_minutes.value='35';
 const ids=Object.fromEntries(['#product-form','#product-msg','#product-image-preview','#btn-visibility','#btn-delete','#admin-gate','#product-editor','#editor-title','#product-image-file'].map(n=>[n,element()]));
 const submit=element(); ids['#product-form'].elements={namedItem:n=>fields[n]}; ids['#product-form'].querySelector=()=>submit;
 let init,uploads=0,saves=0,failUpload=false,failSave=false,lastSaved;
 const data={isDemo:false,init:async()=>{},getSession:async()=>({user:{id:'admin',is_admin:true}}),getProducts:async()=>[],uploadProductPhoto:async f=>{uploads++;assert.equal(f,file);if(failUpload)throw Error('Upload unavailable');return 'https://test.invalid/cake.jpg';},saveProduct:async p=>{saves++;lastSaved=p;if(failSave)throw Error('Save unavailable');}};
 const loc={search:'',href:'',replace(){throw Error('unexpected redirect')}};
 const ctx=vm.createContext({window:{SAMALBAKES:{data,productPhoto:photo,chrome:{boot:async()=>{}}}},document:{querySelector:s=>ids[s],addEventListener:(n,fn)=>init=fn,documentElement:{setAttribute(){}}},location:loc,URL:Object.assign(class extends URL {},{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}}),URLSearchParams});
 vm.runInContext(fs.readFileSync(path.join(root,'js/admin-product.js'),'utf8'),ctx); await init();
 return {fields,ids,submit,loc,select:()=>{ids['#product-image-file'].files=[file];ids['#product-image-file'].value='cake.jpg';ids['#product-image-file'].listeners.change();},save:()=>ids['#product-form'].listeners.submit({preventDefault(){},target:ids['#product-form']}),get uploads(){return uploads},get saves(){return saves},get saved(){return lastSaved},set failUpload(v){failUpload=v},set failSave(v){failSave=v}};
}
(async()=>{
 assert.equal(photo.validate(file),'jpg');
 for(const f of [{type:'image/svg+xml',size:1},{type:'image/jpeg',size:0},{type:'image/png',size:5242881}])assert.throws(()=>photo.validate(f));
 let e=await editor();e.select();assert.equal(e.uploads,0);assert.equal(e.ids['#product-image-file'].value,'cake.jpg');assert.equal(e.ids['#product-image-preview'].src,'blob:test');await e.save();assert.equal(e.uploads,1);assert.equal(e.saved.image_url,'https://test.invalid/cake.jpg');assert.equal(e.saved.photo_real,true);assert.equal(e.saved.example,false);assert.equal(e.loc.href,'admin.html#products');
 e=await editor();e.select();e.failUpload=true;await e.save();assert.equal(e.saves,0);assert.equal(e.fields.name.value,'Test cake');assert.equal(e.submit.disabled,false);assert.equal(e.ids['#product-msg'].textContent,'Upload unavailable');e.failUpload=false;await e.save();assert.equal(e.saves,1);
 e=await editor();e.select();e.failSave=true;await e.save();assert.equal(e.uploads,1);assert.equal(e.fields.image_url.value,'https://test.invalid/cake.jpg');e.failSave=false;await e.save();assert.equal(e.uploads,1);assert.equal(e.saves,2);
 e=await editor();e.select();e.fields.image_url.value='https://test.invalid/manual.png';e.fields.image_url.listeners.input();await e.save();assert.equal(e.uploads,0);assert.equal(e.saved.image_url,'https://test.invalid/manual.png');
 console.log('Photo editor: selection, save, failure/retry, URL override, and validation checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});

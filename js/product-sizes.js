(function(root,factory){var api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SAMALBAKES.productSizes=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function validate(rows){
    if(!Array.isArray(rows)||rows.length>30)throw new Error('Use at most 30 sizes per product.');
    var ids=new Set(),labels=new Set();
    return rows.map(function(size){var s=Object.assign({},size);s.label=String(s.label||'').trim();
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(s.id||'')||ids.has(s.id))throw new Error('Each size needs a unique ID.');
      if(!s.label||s.label.length>80||labels.has(s.label.toLowerCase()))throw new Error('Enter a different name for each size.');
      s.price=Number(s.price);if(!Number.isFinite(s.price)||s.price<0||s.price>9999999999.99)throw new Error('Enter a valid size price.');s.price=Math.round(s.price*100)/100;
      if(s.bake_time_minutes===''||s.bake_time_minutes==null)s.bake_time_minutes=null;
      else {s.bake_time_minutes=Number(s.bake_time_minutes);if(!Number.isInteger(s.bake_time_minutes)||s.bake_time_minutes<0||s.bake_time_minutes>10080)throw new Error('Enter a whole number of bake minutes for each size.');}
      ids.add(s.id);labels.add(s.label.toLowerCase());return s;
    });
  }
  function key(id,sizeId){return sizeId?'size:'+JSON.stringify([id,sizeId]):id;}
  function select(p,sizeId){
    if(!(p.sizes||[]).length){if(sizeId)throw new Error('This size is no longer available.');return Object.assign({},p,{size_id:null});}
    var s=p.sizes.find(function(s){return s.id===sizeId;});if(!s)throw new Error('Choose an available size for '+p.name+'.');
    return Object.assign({},p,{size_id:s.id,size_label:s.label,name:p.name+' — '+s.label,price:Number(s.price),bakeTimeMinutes:s.bake_time_minutes==null?p.bakeTimeMinutes:s.bake_time_minutes,bake_time_minutes:s.bake_time_minutes==null?p.bake_time_minutes:s.bake_time_minutes,image:s.image_url||p.image});
  }
  function resolve(products,cartKey){
    var id=cartKey,sizeId=null;
    if(cartKey.indexOf('size:')===0){try{var pair=JSON.parse(cartKey.slice(5));if(!Array.isArray(pair)||pair.length!==2)return null;id=pair[0];sizeId=pair[1];}catch(e){return null;}}
    var p=products.find(function(p){return p.id===id;});
    if(!sizeId){var match;products.some(function(item){return (item.sizes||[]).some(function(s){if(s.legacy_product_id===id){match={p:item,s:s};return true;}return false;});});if(match){p=match.p;sizeId=match.s.id;}}
    if(!p)return null;try{return {product:select(p,sizeId),key:key(p.id,sizeId)};}catch(e){return null;}
  }
  return {validate:validate,key:key,select:select,resolve:resolve};
});

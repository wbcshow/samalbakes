(function(){
  'use strict';var SB=window.SAMALBAKES;
  SB.sizeEditor={init:function(product){
    var el=document.querySelector('#product-sizes'),button=document.querySelector('#add-product-size');if(!el)return;
    function toggle(){var sized=el.children.length>0;var price=document.querySelector('#product-price');price.disabled=sized;price.required=!sized;}
    function add(size){var row=document.createElement('div');row.className='product-size-row';row.sizeData=size||{id:'s-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)};
      row.innerHTML='<label>Size<input data-size-label required maxlength="80" placeholder="e.g. 6 inches" /></label><label>Price (PHP)<input data-size-price type="number" min="0" max="9999999999.99" step="0.01" required /></label><label>Bake minutes (optional)<input data-size-bake type="number" min="0" max="10080" step="1" placeholder="Use product bake time" /></label><button type="button" class="btn ghost">Remove size</button>';
      row.querySelector('[data-size-label]').value=row.sizeData.label||'';row.querySelector('[data-size-price]').value=row.sizeData.price==null?'':row.sizeData.price;row.querySelector('[data-size-bake]').value=row.sizeData.bake_time_minutes==null?'':row.sizeData.bake_time_minutes;
      row.querySelector('button').onclick=function(){row.remove();toggle();};el.appendChild(row);toggle();}
    (product&&product.sizes||[]).forEach(add);button.onclick=function(){add();};toggle();
  },read:function(){var el=document.querySelector('#product-sizes');if(!el)return [];return SB.productSizes.validate(Array.from(el.children).map(function(row){return Object.assign({},row.sizeData,{label:row.querySelector('[data-size-label]').value,price:row.querySelector('[data-size-price]').value,bake_time_minutes:row.querySelector('[data-size-bake]').value});}));}};
})();

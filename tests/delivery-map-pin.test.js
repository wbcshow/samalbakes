const {JSDOM}=require('../.review-tools/ui/node_modules/jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
  const dom=new JSDOM(fs.readFileSync('delivery.html','utf8'),{runScripts:'outside-only',url:'https://samalbakes.com/delivery.html'}),w=dom.window,d=w.document;
  let start,map,markers=[];
  const add=d.addEventListener.bind(d);d.addEventListener=(name,fn,...args)=>name==='DOMContentLoaded'?start=fn:add(name,fn,...args);
  w.eval(fs.readFileSync('js/config.js','utf8'));w.eval(fs.readFileSync('js/delivery.js','utf8'));w.eval(fs.readFileSync('js/product-sizes.js','utf8'));
  const SB=w.SAMALBAKES;SB.products=[];SB.promos=[];
  SB.chrome={boot:async()=>{},escapeHtml:require('../js/chrome').escapeHtml,refreshCartBadge:()=>{}};
  SB.data={init:async()=>{},getSettings:async()=>({delivery_fee_type:'flat',delivery_fee_flat:80,free_delivery_min_order:1500}),getSession:async()=>null,calcDeliveryFee:()=>80};
  function layer(){return {addTo(){return this}};}
  w.L={map(){map={events:{},setView(point,zoom){this.center={lat:point[0],lng:point[1]};this.zoom=zoom;return this},on(name,fn){this.events[name]=fn;return this},getCenter(){return this.center},getZoom(){return this.zoom},removeLayer(marker){markers=markers.filter(m=>m!==marker)},invalidateSize(){}};return map;},tileLayer:layer,circle:layer,marker(point,options){const marker={point,options,events:{},addTo(){markers.push(this);return this},on(name,fn){this.events[name]=fn;return this},getLatLng(){return {lat:this.point[0],lng:this.point[1]}}};return marker;}};
  w.eval(fs.readFileSync('js/app.js','utf8'));await start();
  assert.equal(markers.length,0,'Only customer pins are shown');
  map.zoom=16;map.center={...SB.config.delivery.center};d.getElementById('delivery-place-pin').click();
  assert.equal(markers.length,1);assert.equal(markers[0].options.draggable,true);assert.match(d.getElementById('delivery-result').textContent,/in our delivery area/);assert.equal(map.zoom,16);
  map.events.click({latlng:{lat:40,lng:125}});
  assert.equal(markers.length,1);assert.match(d.getElementById('delivery-result').textContent,/Outside our current zone/);
  const marker=markers[0];marker.point=[SB.config.delivery.center.lat,SB.config.delivery.center.lng];marker.events.dragend({target:marker});
  assert.equal(markers.length,1);assert.match(d.getElementById('delivery-result').textContent,/in our delivery area/);assert.equal(map.zoom,16);
  dom.window.close();console.log('Delivery page pin: map-center button, tapping, dragging, coverage changes, preserved zoom and single customer marker pass.');
})().catch(e=>{console.error(e);process.exitCode=1;});

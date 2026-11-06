const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = Object.fromEntries(['checkout-search','checkout-search-button','checkout-pin-status','checkout-confirm','checkout-locate','checkout-center','checkout-map'].map(id => [id, {}]));
let map, marker, geoSuccess;
function layer() { return {addTo(){return this},on(){return this},bindPopup(){return this}}; }
const L = {
  map(){ map = {events:{},setView(point,zoom){this.point=point;this.zoom=zoom;return this},on(name,fn){this.events[name]=fn},getCenter(){return {lat:7,lng:125}},invalidateSize(){}};return map; },
  tileLayer:layer,circle:layer,
  marker(point,options){const m=Object.assign(layer(),{point,events:{},on(name,fn){this.events[name]=fn;return this},setLatLng(p){this.point=p},getLatLng(){return {lat:this.point[0],lng:this.point[1]}}});if(options)marker=m;return m;}
};
const context = {window:{SAMALBAKES:{}},L,document:{getElementById:id=>elements[id]},navigator:{geolocation:{getCurrentPosition(fn){geoSuccess=fn}}}};
vm.createContext(context);
for(const name of ['delivery','checkout-pin'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js/'+name+'.js'),'utf8'),context);
const SB=context.window.SAMALBAKES;
let updates=0;
SB.initCheckoutPin({center:{lat:7,lng:125},radiusKm:25},()=>updates++);
assert.deepEqual(Array.from(map.point),[7,125]); // Saved bakery settings control initial view.
assert.equal(SB.checkoutPin.confirmed,false);
map.events.click({latlng:{lat:7.01,lng:125.01}});
assert.equal(SB.checkoutPin.inZone,true);
elements['checkout-confirm'].onclick();
assert.equal(SB.checkoutPin.confirmed,true);
assert.match(SB.checkoutPin.url,/7.010000,125.010000/);
assert.ok(SB.checkoutPin.distanceKm>0);
marker.events.dragstart();
assert.equal(SB.checkoutPin.confirmed,false);
map.events.click({latlng:{lat:40,lng:125}});
assert.equal(SB.checkoutPin.inZone,false);
assert.equal(elements['checkout-confirm'].disabled,true);
elements['checkout-confirm'].onclick();
assert.equal(SB.checkoutPin.confirmed,false);
elements['checkout-locate'].onclick();
map.events.click({latlng:{lat:7.02,lng:125.02}});
elements['checkout-confirm'].onclick();
geoSuccess({coords:{latitude:40,longitude:125}});
assert.equal(SB.checkoutPin.confirmed,true); // Late GPS cannot overwrite manual selection.
assert.equal(SB.checkoutPin.lat,7.02);
assert.ok(updates>=5);
console.log('Checkout pin coverage, confirmation, edits and GPS race tests passed');

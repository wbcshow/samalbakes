const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = Object.fromEntries(['checkout-search','checkout-search-button','checkout-pin-status','checkout-confirm','checkout-locate','checkout-center','checkout-map'].map(id => [id, {}]));
let map, marker, geoSuccess, geoError;
function layer() { return {addTo(){return this},on(){return this},bindPopup(){return this}}; }
const L = {
  map(){ map = {events:{},setView(point,zoom){this.point=point;this.zoom=zoom;return this},on(name,fn){this.events[name]=fn},getCenter(){return {lat:7,lng:125}},invalidateSize(){}};return map; },
  tileLayer:layer,circle:layer,
  marker(point,options){const m=Object.assign(layer(),{point,events:{},on(name,fn){this.events[name]=fn;return this},setLatLng(p){this.point=p},getLatLng(){return {lat:this.point[0],lng:this.point[1]}}});if(options)marker=m;return m;}
};
const context = {window:{SAMALBAKES:{}},L,document:{getElementById:id=>elements[id]},navigator:{geolocation:{getCurrentPosition(fn,fail){geoSuccess=fn;geoError=fail}}}};
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
elements['checkout-locate'].onclick();
SB.checkoutPin.cancelLookup();
geoSuccess({coords:{latitude:40,longitude:125}});
assert.equal(SB.checkoutPin.lat,7.02);
assert.equal(SB.checkoutPin.confirmed,true);
SB.checkoutPin.setMethod('location');
assert.equal(SB.checkoutPin.confirmed,false);
geoSuccess({coords:{latitude:7.03,longitude:125.03}});
assert.equal(SB.checkoutPin.confirmed,true,'Eligible GPS location confirms automatically');
map.events.click({latlng:{lat:40,lng:125}});
marker.events.dragstart();marker.events.dragend();
assert.equal(SB.checkoutPin.lat,7.03,'GPS pin ignores map clicks and drag events');
assert.equal(SB.checkoutPin.confirmed,true);
SB.checkoutPin.setMethod('pin');
map.events.click({latlng:{lat:7.04,lng:125.04}});
assert.equal(SB.checkoutPin.confirmed,false,'Manual selection still requires confirmation');
SB.checkoutPin.setMethod('location');
geoSuccess({coords:{latitude:40,longitude:125}});
assert.equal(SB.checkoutPin.confirmed,false,'Out-of-area GPS does not confirm');
SB.checkoutPin.setMethod('location');geoError({code:1});
assert.equal(SB.checkoutPin.confirmed,false,'Denied GPS does not reuse a previous confirmation');
assert.equal(elements['checkout-locate'].hidden,false,'Location failure offers retry');
assert.ok(updates>=5);
console.log('Checkout pin coverage, confirmation, edits and GPS race tests passed');

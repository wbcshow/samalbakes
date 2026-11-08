const {JSDOM}=require('../.review-tools/ui/node_modules/jsdom');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM(fs.readFileSync('promotions.html','utf8'),{runScripts:'outside-only',url:'https://samalbakes.com/promotions.html'}),w=dom.window,d=w.document;
 let start;const add=d.addEventListener.bind(d);d.addEventListener=(name,fn,...args)=>name==='DOMContentLoaded'?start=fn:add(name,fn,...args);
 for(const f of ['config','products','promos','data','tasting-requests'])w.eval(fs.readFileSync('js/'+f+'.js','utf8'));
 const SB=w.SAMALBAKES;SB.chrome={boot:async()=>{},refreshCartBadge:()=>{},escapeHtml:require('../js/chrome').escapeHtml};
 await SB.data.init();await SB.data.saveSettings({free_delivery_min_order:2300});
 w.eval(fs.readFileSync('js/app.js','utf8'));await start();
 const text=d.querySelector('#promo-list').textContent;
 assert.match(text,/Free delivery on ₱2,300 or more/);assert.match(text,/after discounts/);assert.match(text,/No code needed/);
 assert.equal(text.includes('FREESHIP1500'),false);assert.equal(text.includes('TASTEBOX'),false);
 const form=d.querySelector('#tasting-request-form'),button=form.querySelector('button'),msg=d.querySelector('#tasting-request-message');
 form.elements.business_name.value='<Business>';form.elements.email.value='test@example.test';form.elements.phone.value='09152943883';
 let fail=true,ids=[],resolveSend;
 const realRequest=SB.data.requestTastingBox;
 SB.data.requestTastingBox=async payload=>{ids.push(payload.id);if(fail)throw new Error('Connection lost');return new Promise(resolve=>{resolveSend=()=>resolve(realRequest(payload));});};
 await form.onsubmit({preventDefault(){}});assert.equal(msg.textContent,'Connection lost');assert.equal(button.disabled,false);assert.equal(form.elements.business_name.value,'<Business>');
 fail=false;const sending=form.onsubmit({preventDefault(){}});assert.equal(button.disabled,true);
 await form.onsubmit({preventDefault(){}});assert.equal(ids.length,2);assert.equal(ids[0],ids[1],'Retry uses the same request identifier');
 resolveSend();await sending;assert.equal(form.hidden,true);assert.match(msg.textContent,/Request received/);
 assert.equal(w.sessionStorage.getItem('sb_tasting_pending'),null);
 await SB.data.login(SB.data.demoCredentials.email,SB.data.demoCredentials.password);
 const requests=await SB.data.getTastingRequests();assert.equal(requests.length,1);assert.equal(requests[0].business_name,'<Business>');
 const admin=new JSDOM(fs.readFileSync('admin.html','utf8'),{runScripts:'outside-only',url:'https://samalbakes.com/admin.html'}),a=admin.window;
 a.SAMALBAKES={data:SB.data};a.eval(fs.readFileSync('js/admin-tastings.js','utf8'));await a.SAMALBAKES.adminTastings.init();
 assert.equal(a.document.querySelector('#tasting-requests h3').textContent,'<Business>');assert.equal(a.document.querySelector('#tasting-requests Business'),null);
 const status=a.document.querySelector('#tasting-requests select');status.value='contacted';await status.onchange();
 assert.equal((await SB.data.getTastingRequests())[0].status,'contacted');
 SB.data.updateTastingStatus=async()=>{throw new Error('Save failed');};status.value='approved';await status.onchange();assert.equal(status.value,'contacted');assert.equal(status.disabled,false);
 // Automatic card is not a competing editable promotion; save retains it.
 a.SAMALBAKES.chrome=SB.chrome;a.eval(fs.readFileSync('js/promos.js','utf8'));a.eval(fs.readFileSync('js/admin-promotions.js','utf8'));
 let saved;a.SAMALBAKES.data={saveSettings:async values=>{saved=values;}};
 a.SAMALBAKES.adminPromotions.init({promotions:a.SAMALBAKES.promos});
 assert.equal(a.document.querySelector('[data-id="free-del"]'),null);
 await a.document.querySelector('#promotions-form').onsubmit({preventDefault(){}});
 assert.equal(saved.promotions[1].id,'free-del');assert.equal(Boolean(saved.promotions[1].code),false);
 assert.equal(Boolean(saved.promotions.find(p=>p.id==='tasting-box').code),false);
 a.close();dom.window.close();console.log('Promotion threshold display, no-code cards, request retry/double-submit, admin status/error feedback and automatic-card preservation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});



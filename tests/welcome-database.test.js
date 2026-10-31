// Isolated PostgreSQL tests; install @electric-sql/pglite in .review-tools first.
const { PGlite } = require('../.review-tools/node_modules/@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
let checks = 0;
const db = new PGlite();
const sql = file => fs.readFileSync(path.join(root, file), 'utf8');
async function check(name, fn) { await fn(); checks++; console.log('PASS ' + name); }
async function identity(id = '') { await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]); }
async function order({code='SAMALWELCOME',email=null,phone=null,items=[{product_id:'test-cake',qty:1}],distance=2}={}) {
 const r=await db.query('select public.place_order($1::jsonb,$2,$3,$4,$5,$6,$7,$8) as id', [JSON.stringify(items),code,'Test customer',email,phone,'Test address',null,distance]);
 return (await db.query('select * from public.orders where id=$1',[r.rows[0].id])).rows[0];
}
async function rejected(payload, pattern=/first orders only/) {
 const before=await db.query('select (select count(*) from public.orders) as orders, (select count(*) from public.order_items) as items');
 await assert.rejects(order(payload),pattern);
 assert.deepEqual((await db.query('select (select count(*) from public.orders) as orders, (select count(*) from public.order_items) as items')).rows,before.rows);
}
(async()=>{
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;`);
 // PGlite has built-in gen_random_uuid; pgcrypto is not needed for this schema.
 let oldSchema=sql('supabase/schema.sql').replace('create extension if not exists "pgcrypto";','');
 const start=oldSchema.indexOf('create or replace function public.normalize_customer_phone');
 const end=oldSchema.indexOf('-- RLS',start);
 oldSchema=oldSchema.slice(0,start)+sql('supabase/reject-out-of-area-orders.sql')+'\n'+oldSchema.slice(end);
 await db.exec(oldSchema);
 await db.exec("insert into public.products(id,name,price) values ('test-cake','Test cake',550.55),('inactive','Hidden cake',10); update products set active=false where id='inactive';");
 await order({code:null,email:'legacy@example.test'});
 await check('migration applies to previous schema and can be rerun',async()=>{await db.exec(sql('supabase/welcome-code-first-order-only.sql'));await db.exec(sql('supabase/welcome-code-first-order-only.sql'));});
 await check('orders predating the migration count without altering their totals',async()=>{await rejected({email:'legacy@example.test'});const old=(await db.query("select * from orders where guest_email='legacy@example.test'")).rows[0];assert.equal(Number(old.total),630.55);});
 await check('Philippine phone formats normalize identically',async()=>{
  for(const phone of ['0915 294 3883','+63 915 294 3883','9152943883','00639152943883']) assert.equal((await db.query('select normalize_customer_phone($1) as phone',[phone])).rows[0].phone,'639152943883');
  assert.equal((await db.query('select normalize_customer_phone(null) as phone')).rows[0].phone,null);
 });
 await check('first guest order gets rounded 10% discount and correct total',async()=>{const o=await order({email:'new@example.test',phone:'09152943883',code:' samalwelcome '});assert.equal(Number(o.subtotal),550.55);assert.equal(Number(o.discount),55.06);assert.equal(Number(o.total),575.49);});
 await check('repeat email is rejected regardless of case or spaces',()=>rejected({email:' NEW@EXAMPLE.TEST '}));
 await check('repeat phone is rejected with alternate country prefix',()=>rejected({phone:'+639152943883'}));
 await check('missing guest identity is rejected without saving an order',()=>rejected({},/Enter an email or phone/));
 await check('unrelated guest remains eligible',async()=>assert(Number((await order({email:'other@example.test'})).discount)>0));
 await check('previous non-promotional order disqualifies a customer',async()=>{await order({email:'returning@example.test',code:null});await rejected({email:'returning@example.test'});});
 await check('cancelled orders count as order history',async()=>{await db.exec("update orders set status='cancelled' where guest_email='returning@example.test'");await rejected({email:'returning@example.test'});});
 await check('returning customers can order without a promotion',async()=>assert.equal(Number((await order({email:'new@example.test',code:null})).discount),0));
 const userA='11111111-1111-4111-8111-111111111111';
 const userB='22222222-2222-4222-8222-222222222222';
 await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)',[userA,'account@example.test',userB,'new@example.test']);
 await check('first authenticated order is eligible using account identity alone',async()=>{await identity(userA);assert(Number((await order()).discount)>0);});
 await check('same account cannot reuse code with changed contact details',()=>rejected({email:'changed@example.test',phone:'09998887777'}));
 await check('guest matches older account order through authenticated email',async()=>{await identity();await rejected({email:'ACCOUNT@EXAMPLE.TEST'});});
 await check('authenticated email matches previous guest order even with changed checkout email',async()=>{await identity(userB);await rejected({email:'bypass@example.test'});await identity();});
 await check('out-of-area orders remain blocked',()=>rejected({email:'outside@example.test',distance:10000},/outside our delivery area/));
 await check('area-list orders with null distance still work',async()=>assert((await order({email:'area@example.test',distance:null})).id));
 await check('invalid product rolls back order shell and preserves eligibility',async()=>{await rejected({email:'retry@example.test',items:[{product_id:'missing',qty:1}]},/Unknown or inactive/);assert((await order({email:'retry@example.test'})).id);});
 await check('invalid quantities roll back without saving',()=>rejected({email:'qty@example.test',items:[{product_id:'test-cake',qty:0}]},/Invalid qty/));
 await check('inactive products cannot be purchased',()=>rejected({email:'hidden@example.test',items:[{product_id:'inactive',qty:1}]},/Unknown or inactive/));
 await check('RESORT50 still applies at the qualifying subtotal',async()=>assert.equal(Number((await order({code:'RESORT50',items:[{product_id:'test-cake',qty:2}]})).discount),50));
 await check('free delivery uses subtotal after discount',async()=>assert.equal(Number((await order({email:'free@example.test',items:[{product_id:'test-cake',qty:4}]})).delivery_fee),0));
 await check('per-kilometer fee still works',async()=>{await db.exec("update settings set delivery_fee_type='per_km'");assert.equal(Number((await order({code:null,distance:2.5})).delivery_fee),37.5);});
 await check('flat plus per-kilometer fee still works',async()=>{await db.exec("update settings set delivery_fee_type='flat_plus_per_km'");assert.equal(Number((await order({code:null,distance:2.5})).delivery_fee),117.5);});
 await check('anonymous role can call checkout but cannot read guest history',async()=>{await db.exec('set role anon');const r=await db.query("select place_order('[{\"product_id\":\"test-cake\",\"qty\":1}]','SAMALWELCOME','Guest','role@example.test') as id");assert(r.rows[0].id);assert.equal((await db.query('select * from orders')).rows.length,0);await db.exec('reset role');});
 await check('anonymous callers cannot bypass eligibility or insert orders directly',async()=>{await db.exec('set role anon');await assert.rejects(db.query("select place_order('[{\"product_id\":\"test-cake\",\"qty\":1}]','SAMALWELCOME','Guest','ROLE@EXAMPLE.TEST')"),/first orders only/);await assert.rejects(db.exec("insert into orders(guest_email) values ('bypass@example.test')"),/permission denied/);await db.exec('reset role');});
 await check('authenticated role can read only its own history and cannot reuse code',async()=>{await identity(userA);await db.exec('set role authenticated');const rows=(await db.query('select * from orders')).rows;assert(rows.length>0);assert(rows.every(o=>o.user_id===userA));await assert.rejects(db.query("select place_order('[{\"product_id\":\"test-cake\",\"qty\":1}]','SAMALWELCOME')"),/first orders only/);await db.exec('reset role');await identity();});
 await check('fresh-install and migration function definitions stay in sync',async()=>{const schema=sql('supabase/schema.sql');const migration=sql('supabase/welcome-code-first-order-only.sql');const extract=s=>s.slice(s.indexOf('create or replace function public.normalize_customer_phone'),s.indexOf('grant execute on function public.place_order to anon, authenticated;')).trim();assert.equal(extract(schema),extract(migration));});
 console.log(`\n${checks} PostgreSQL checks passed. No Supabase connection was used.`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close());

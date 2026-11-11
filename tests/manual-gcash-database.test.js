const {PGlite}=require('../.review-tools/node_modules/@electric-sql/pglite');
const fs=require('fs'),assert=require('node:assert/strict');
const db=new PGlite();
(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;
 create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
 create schema net;create table net._http_response(id bigint,status_code int);
 create table net.requests(id bigserial,body jsonb,headers jsonb);
 create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$insert into net.requests(body,headers) values(body,headers) returning id$$;
 create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 for(const file of ['schema','product-sizes','resort-partners','order-email-notifications','accept-orders-confirm-ready','tasting-box-requests','manual-gcash','manual-gcash']){
   await db.exec(fs.readFileSync('supabase/'+file+'.sql','utf8').replace(/^create extension.*$/gm,''));
 }
 const admin='11111111-1111-4111-8111-111111111111',customer='22222222-2222-4222-8222-222222222222';
 await db.exec(`insert into auth.users(id,email) values('${admin}','admin@example.test'),('${customer}','customer@example.test');update profiles set is_admin=true where id='${admin}';
 insert into products(id,name,price,sizes) values('cake','Cake',500,'[{"id":"small","label":"Small","price":500.25}]');
 update order_email_settings set enabled=true;insert into vault.decrypted_secrets values('order_email_resend_api_key','fake');`);
 async function as(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);}
 async function place(method='gcash',code=null,size='small'){return (await db.query(`select place_order_with_payment($1::jsonb,$2,p_guest_name=>'Customer',p_guest_phone=>'09150000000',p_guest_email=>'customer@example.test',p_promo_code=>$3) result`,[JSON.stringify([{product_id:'cake',size_id:size,qty:2}]),method,code])).rows[0].result;}
 await as('','anon');
 const guest=await place();assert.equal(Number(guest.total),1080.5);assert.equal(guest.payment_status,'awaiting_verification');
 assert.deepEqual(Object.keys(guest).sort(),['id','payment_method','payment_status','total']);
 assert.equal((await db.query('select * from orders')).rows.length,0,'Guests cannot reread orders');
 await assert.rejects(place('paid'),/Choose/);await assert.rejects(place(null),/Choose/);
 await assert.rejects(db.query('select verify_gcash_payment($1,null)',[guest.id]),/permission denied/);
 await db.exec('reset role');const before=Number((await db.query('select count(*) n from orders')).rows[0].n);
 await assert.rejects(place('gcash',null,'missing'),/available size/);
 assert.equal(Number((await db.query('select count(*) n from orders')).rows[0].n),before,'Bad size rolls back entire order');
 await as(customer);const cod=await place('cod');assert.equal(cod.payment_status,'unpaid');
 const discounted=await place('gcash','SAMALWELCOME').catch(e=>{assert.match(e.message,/first orders/);return null;});assert.equal(discounted,null);
 const own=await place();
 await assert.rejects(db.query('select verify_gcash_payment($1,null)',[own.id]),/Admin access/);
 assert.equal((await db.query("update orders set payment_status='paid',payment_verified_at=now(),payment_verified_by=auth.uid() where id=$1 returning id",[own.id])).rows.length,0,'RLS blocks customer verification');
 await as(admin);let row=(await db.query('select * from orders where id=$1',[guest.id])).rows[0];
 await assert.rejects(db.query('select verify_gcash_payment($1,now())',[guest.id]),/changed/);
 const verified=(await db.query('select verify_gcash_payment($1,$2) result',[guest.id,row.updated_at])).rows[0].result;
 assert.equal(verified.payment_status,'paid');assert.equal(verified.payment_verified_by,admin);
 await assert.rejects(db.query('select verify_gcash_payment($1,$2)',[guest.id,row.updated_at]),/changed/);
 await assert.rejects(db.query('select verify_gcash_payment($1,$2)',[cod.id,row.updated_at]),/changed/);
 // Payment verification does not accept the order or queue a customer confirmation.
 assert.equal(verified.status,'new');
 await db.query("select confirm_order_ready($1,now()+interval '2 days','',$2)",[guest.id,verified.updated_at]);
 await db.exec('reset role;select bakery_private.send_order_emails()');
 const messages=(await db.query('select payload from order_email_outbox')).rows.map(x=>x.payload?.text||'');
 assert(messages.some(x=>/GCash - paid/.test(x)));assert(messages.some(x=>/GCash - awaiting verification/.test(x)));assert(messages.some(x=>/Cash on Delivery/.test(x)));
 console.log('GCash: guest totals, decimal prices/sizes, rollback, COD, permissions, stale/repeated verification, acceptance and payment-aware emails pass.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());

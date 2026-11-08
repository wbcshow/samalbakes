const {PGlite}=require('../.review-tools/node_modules/@electric-sql/pglite');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;`);
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8').replace('create extension if not exists "pgcrypto";',''));
 const migration=fs.readFileSync('supabase/resort-partners.sql','utf8');
 await db.exec(migration);await db.exec(migration);
 const admin='11111111-1111-4111-8111-111111111111',partner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
 await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
 ('${admin}','admin@example.test',now()),('${partner}','partner@example.test',now()),('${other}','other@example.test',null);
 update profiles set is_admin=true where id='${admin}';insert into products(id,name,price) values('cake','Cake',800);grant update on settings to authenticated;`);
 async function as(id,role='authenticated') {await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);}
 async function order(email='partner@example.test',qty=1) {return db.query('select place_order($1::jsonb,$2,$3,$4)',[JSON.stringify([{product_id:'cake',qty}]),'RESORT50','Test',email]);}
 await as('','anon');await assert.rejects(order(),/Sign in/);
 await as(other);await assert.rejects(order(),/approved resort/);
 await assert.rejects(db.query("select save_resort_partner('other@example.test','Other',true)"),/Admin access/);
 await assert.rejects(db.query('select * from list_resort_partners()'),/Admin access/);
 await assert.rejects(db.query(`insert into resort_partners values('${other}','Other',true,now())`),/permission denied/);
 await as(admin);
 await assert.rejects(db.query("select save_resort_partner('missing@example.test','Missing',true)"),/No account/);
 await assert.rejects(db.query("select save_resort_partner('other@example.test','Other',true)"),/verify/);
 await db.query("select save_resort_partner(' PARTNER@example.test ','Test Resort',true)");
 assert.equal((await db.query('select * from list_resort_partners()')).rows.length,1);
 await as(partner);await order();await order();
 assert.equal((await db.query('select discount from orders order by created_at')).rows.every(o=>Number(o.discount)===50),true);
 assert.equal((await db.query('select * from resort_partners')).rows.length,1);
 await assert.rejects(db.query("select save_resort_partner('partner@example.test','Hacked',true)"),/Admin access/);
 await as(other);assert.equal((await db.query('select * from resort_partners')).rows.length,0);
 await assert.rejects(order(),/approved resort/);
 await as(admin);await db.exec(`update settings set promotions=(select jsonb_agg(case when p->>'code'='RESORT50' then jsonb_set(p,'{minSubtotal}','1000') else p end) from jsonb_array_elements(promotions) p) where id=1;`);
 await as(partner);await assert.rejects(order(),/minimum/);await order('partner@example.test',2);
 await as(admin);await db.query("select save_resort_partner('partner@example.test','Test Resort',false)");
 await as(partner);await assert.rejects(order('partner@example.test',2),/approved resort/);
 await as(admin);await db.query("select save_resort_partner('partner@example.test','Test Resort',true)");
 await as(partner);await order('partner@example.test',2);
 await db.close();console.log('Resort partner approval, repeat orders, minimum, spoofing, revocation and permissions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});


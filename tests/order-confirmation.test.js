const assert=require('node:assert/strict');
const model=require('../js/order-confirmation');
const realNow=Date.now;Date.now=()=>Date.parse('2026-11-06T12:00:00Z');
try{
  assert.equal(model.localInput('2026-11-07T03:15:00Z'),'2026-11-07T11:15');
  assert.equal(model.utcInput('2026-11-07T11:15'),'2026-11-07T03:15:00.000Z');
  for(const value of ['', '2026-02-30T11:00','2026-11-05T11:00','invalid'])assert.throws(()=>model.utcInput(value));
  assert.equal(model.historyLabel({estimated_ready_at:'estimate'},x=>x),'Ready est.: estimate');
  assert.equal(model.historyLabel({estimated_ready_at:'estimate',confirmed_ready_at:'confirmed'},x=>x),'Confirmed ready: confirmed');
  console.log('Philippine date conversion, invalid/past times, and confirmed-history labels pass.');
}finally{Date.now=realNow;}

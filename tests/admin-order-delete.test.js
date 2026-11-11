const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/data.js','utf8');
(async()=>{
  let rows=[{id:'test',updated_at:'v1'},{id:'keep',updated_at:'v2'}],admin=false;
  const demo={getSession:async()=>({user:{is_admin:admin}})};
  vm.runInNewContext(source.match(/  demo\.deleteOrder = async function[\s\S]*?\n  };/)[0],{demo,LS:{orders:'orders'},lsGet:()=>rows,lsSet:(_,value)=>{rows=value;}});
  await assert.rejects(demo.deleteOrder('test','v1'),/Admin/);
  admin=true;await assert.rejects(demo.deleteOrder('test','old'),/changed/);
  assert.equal(rows.length,2);await demo.deleteOrder('test','v1');assert.deepEqual(rows.map(o=>o.id),['keep']);
  let result={data:[{id:'test'}]},filters=[];
  const query={delete(){return this;},eq(...args){filters.push(args);return this;},select:async()=>result};
  const remote={client:{from:table=>{assert.equal(table,'orders');return query;}}};
  vm.runInNewContext(source.match(/  remote\.deleteOrder = async function[\s\S]*?\n  };/)[0],{remote});
  await remote.deleteOrder('test','v1');assert.deepEqual(filters,[['id','test'],['updated_at','v1']]);
  result={data:[]};await assert.rejects(remote.deleteOrder('test','v1'),/changed/);
  result={error:{message:'Permission denied'}};await assert.rejects(remote.deleteOrder('test','v1'),/Permission denied/);
  await assert.rejects(remote.deleteOrder('test',null),/Refresh/);
  console.log('Order deletion: admin authorization, single-order scope, stale order rejection and backend errors pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});

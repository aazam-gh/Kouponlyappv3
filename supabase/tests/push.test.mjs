import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTickets, processNotificationReceipts } from '../functions/_shared/push.ts';

test('accounts for missing tickets and retains devices with invalid provider credentials', () => {
  const result = summarizeTickets([{id:1},{id:2},{id:3},{id:4}], {data:[
    {status:'ok',id:'receipt-1'},
    {status:'error',details:{error:'InvalidCredentials'}},
    {status:'error',details:{error:'DeviceNotRegistered'}},
  ]});
  assert.deepEqual(result.map(x=>[x.accepted,x.invalid]), [[true,false],[false,false],[false,true],[false,false]]);
  assert.equal(result[3].error, 'No push ticket returned');
});

test('whole request errors cannot be reported as successful tickets', () => {
  assert.equal(summarizeTickets([{}], {errors:[{message:'Unauthorized'}]})[0].accepted,false);
});

test('receipt totals are recomputed, credential failures are retained, and campaign fails', async () => {
  const updates=[]; const deletes=[];
  const rows=[{id:'delivery',campaign_id:'campaign',token_id:'device',receipt_id:'receipt',created_at:new Date().toISOString()}];
  const service={from(table) {
    let status; let update; let operation;
    const builder={
      select(){return builder;},eq(key,value){if(key==='status')status=value;return builder;},
      neq(){return builder;},order(){return builder;},limit(){return builder;},single(){return builder;},
      update(value){update=value;operation='update';return builder;},delete(){operation='delete';return builder;},
      then(resolve){
        if(operation==='update')updates.push({table,update});
        if(operation==='delete')deletes.push(table);
        resolve({data:table==='couponly_notifications'?{failed_count:0}:rows, count:status==='error'?1:0,error:null});
      },
    };return builder;
  }};
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({data:{receipt:{status:'error',details:{error:'InvalidCredentials'}}}});
  try{
    await processNotificationReceipts(service);
    assert.equal(deletes.length,0);
    assert.equal(updates.at(-1).update.status,'failed');
    assert.equal(updates.at(-1).update.receipt_failure_count,1);
  }finally{globalThis.fetch=original;}
});

test('successful tickets require a receipt ID', () => {
  const results = summarizeTickets([{}], {data:[{status:'ok'}]});
  assert.equal(results[0].accepted,false);
});

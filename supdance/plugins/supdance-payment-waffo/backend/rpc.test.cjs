const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(__dirname + '/rpc.cjs', 'utf8').replace(/main\(\);\s*$/, '');
const { handleRPC } = vm.runInNewContext(source + '\n({handleRPC})', {
  require, Buffer, TextDecoder, URL, AbortSignal, fetch,
});
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type:'pkcs8', format:'pem' });
const config = { merchantId:'MER_'+'a'.repeat(22), storeId:'STO_'+'b'.repeat(22), productId:'PROD_'+'c'.repeat(22), environment:'prod', taxCategory:'digital_goods', privateKey:key, publicBaseUrl:'https://www.supdance.com' };
const ref='a'.repeat(32);
const valid = () => ({id:'PAY_abc123',status:'succeeded',orderMerchantExternalId:ref,amount:{amount:'10.00',currency:'USD'},onetimeOrder:{id:'ORD_abc123',status:'completed',testMode:false,store:{id:config.storeId},onetimeProduct:{id:config.productId}}});
async function query(payments, operation='query_order', errors) {
  return handleRPC({version:'yingce.payment/v1',operation,config,request:{MerchantOrderNo:ref}},async(url,init)=>{
    const body=JSON.parse(init.body);
    assert.equal(url,'https://api.waffo.ai/v1/graphql');
    assert.match(body.query,/amount\s*\{\s*amount\s+currency\s*\}/);
    assert.equal(body.variables.ref,ref);
    assert.ok(init.headers['X-Signature']);
    return {status:200,json:async()=>({data:{payments},errors})};
  });
}
test('real Money response is converted into exact minor units',async()=>{
 const r=await query([valid()]); assert.equal(r.ok,true);assert.equal(r.data.amountFen,1000);assert.equal(r.data.currency,'USD');assert.equal(r.data.paid,true);
 const p=valid();p.amount={amount:'70.01',currency:'CNY'};const c=await query([p]);assert.equal(c.data.amountFen,7001);assert.equal(c.data.currency,'CNY');
});
test('empty and rejected queries never fabricate payment or closure',async()=>{
 const r=await query([]);assert.equal(r.data.paid,false);assert.equal(r.data.closed,false);
 assert.equal((await query([], 'query_order',[{message:'schema failure'}])).code,'query_failed');
 assert.equal((await query([], 'close_order')).code,'unsupported_operation');
});
test('malformed Money evidence is rejected',async()=>{
 for(const amount of [null,{amount:'0',currency:'USD'},{amount:'1.001',currency:'USD'},{amount:10,currency:'USD'},{amount:'10.00',currency:'EUR'}]){
  const p=valid();p.amount=amount;assert.equal((await query([p])).ok,false);
 }
});
test('duplicate, cross-store, cross-environment and wrong-reference payments are rejected',async()=>{
 assert.equal((await query([valid(),valid()])).code,'payment_evidence_mismatch');
 for(const mutate of [p=>p.onetimeOrder.store.id='STO_wrong',p=>p.onetimeOrder.testMode=true,p=>p.orderMerchantExternalId='b'.repeat(32),p=>p.onetimeOrder.onetimeProduct.id='PROD_wrong']){
  const p=valid();mutate(p);assert.equal((await query([p])).code,'payment_evidence_mismatch');
 }
});
test('late successful payment is returned by close inquiry',async()=>{
 const r=await query([valid()],'close_order');assert.equal(r.data.paid,true);assert.equal(r.data.closed,false);
});
test('unsigned notification cannot credit an account',async()=>{
 const r=await handleRPC({version:'yingce.payment/v1',operation:'verify_notification',config,headers:{},bodyBase64:Buffer.from('{}').toString('base64')});assert.equal(r.code,'invalid_notification');
});

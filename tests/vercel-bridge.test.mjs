import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {proxyRequest} from '../api/bridge.mjs';
async function request(endpoint,{method='GET',body,headers={},parsed=false,fetcher}={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/bridge?endpoint='+encodeURIComponent(endpoint),method,headers:{host:'e3health.vercel.app',...headers}});if(parsed)req.body=body;
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=String(body)}};
 await proxyRequest(req,res,fetcher||(()=>{throw Error('Unexpected upstream call')}));return res;
}
test('catalog bridge forces customer mode and strips authentication',async()=>{
 const r=await request('products',{headers:{cookie:'private',authorization:'secret','oai-authenticated-user-email':'fake'},fetcher:async(url,opts)=>{assert.equal(url.search,'?customer=1');assert.equal(opts.headers.cookie,undefined);assert.equal(opts.headers.authorization,undefined);assert.equal(opts.headers['oai-authenticated-user-email'],undefined);return Response.json({admin:false,products:[]})}});assert.equal(r.statusCode,200);assert.equal(r.headers['Cache-Control'],'no-store');
});
for(const parsed of [false,true])test('order forwards '+(parsed?'Vercel-parsed':'streamed')+' JSON with trusted origin',async()=>{
 const body={submissionKey:'test',items:[]};const r=await request('order',{method:'POST',body,parsed,headers:{'content-type':'application/json',origin:'https://e3health.vercel.app'},fetcher:async(url,opts)=>{assert.equal(url.pathname,'/api/order');assert.equal(opts.headers.Origin,url.origin);assert.deepEqual(JSON.parse(opts.body),body);return Response.json({error:'Empty order'},{status:400})}});assert.equal(r.statusCode,400);
});
test('admin routes, traversal, product writes and cross-origin posts blocked',async()=>{
 for(const endpoint of ['orders','orders/id/proforma','../api/orders','https://evil.test'])assert.equal((await request(endpoint)).statusCode,404);
 assert.equal((await request('products',{method:'POST'})).statusCode,404);
 assert.equal((await request('order',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.test'}})).statusCode,403);
});
test('order size and upstream errors handled',async()=>{
 assert.equal((await request('order',{method:'POST',body:{x:'x'.repeat(66000)},headers:{'content-type':'application/json'}})).statusCode,413);
 assert.equal((await request('products',{fetcher:async()=>new Response('<html>Login</html>',{headers:{'content-type':'text/html'}})})).statusCode,502);
 assert.equal((await request('products',{fetcher:async()=>{throw Error('offline')}})).statusCode,502);
});

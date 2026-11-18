/** Public storefront bridge. Admin sessions stay on the existing Sites host. */
const BACKEND='https://e3health-stock-studio.psilocyber-9989.chatgpt.site';
export async function proxyRequest(req,res,fetcher=fetch){
 const fail=(status,message)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:message}));};
 const url=new URL(req.url,'https://storefront.invalid');
 const endpoint=url.searchParams.get('endpoint')||'';
 const method=req.method||'GET';
 const read=method==='GET'&&(endpoint==='products'||/^photos\/[0-9a-f-]{36}$/.test(endpoint)||/^proformas\/[0-9a-f-]{36}\.pdf$/.test(endpoint));
 const write=method==='POST'&&endpoint==='order';
 if(!read&&!write)return fail(404,'Not found. Admin tools are available through Admin sign in.');
 // Never forward visitor cookies, authorization, or authenticated-user headers.
 const target=new URL('/api/'+endpoint,BACKEND);
 if(endpoint==='products')target.searchParams.set('customer','1');
 const headers={Accept:endpoint==='products'||write?'application/json':'*/*'};
 let body;
 if(write){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return fail(415,'Send the order as JSON.');
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host)return fail(403,'Not allowed.');}catch{return fail(403,'Not allowed.');}}
  if(Number(req.headers['content-length'])>65536)return fail(413,'This order is too large.');
  if(req.body!==undefined){body=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));if(body.length>65536)return fail(413,'This order is too large.');}
  else{const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>65536)return fail(413,'This order is too large.');chunks.push(Buffer.from(chunk));}body=Buffer.concat(chunks);}
  headers['Content-Type']='application/json';headers.Origin=BACKEND;
 }
 try{
  const response=await fetcher(target,{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(25000)});
  if(response.status>=300&&response.status<400)return fail(502,'The store is temporarily unavailable. Please try again.');
  const contentType=response.headers.get('content-type')||'application/octet-stream';
  if((endpoint==='products'||write)&&!contentType.includes('application/json'))return fail(502,'The store is temporarily unavailable. Please try again.');
  res.statusCode=response.status;
  res.setHeader('Content-Type',contentType);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const disposition=response.headers.get('content-disposition');if(disposition)res.setHeader('Content-Disposition',disposition);
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch{return fail(502,'Could not reach E3Health. Please try again.');}
}
export default async function handler(req,res){return proxyRequest(req,res);}

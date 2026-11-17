import {env} from 'cloudflare:workers';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}\.pdf$/.test(id))return new Response('Not found',{status:404});
 const file=await env.BUCKET?.get('proformas/'+id);if(!file)return new Response('This pro forma could not be found.',{status:404});
 const reference=file.customMetadata?.reference||'E3Health-proforma';
 return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${reference}.pdf"`,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
}

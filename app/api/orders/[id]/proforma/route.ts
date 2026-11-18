import {env} from 'cloudflare:workers';
import {eq} from 'drizzle-orm';
import {getDb} from '../../../../../db';
import {orders} from '../../../../../db/schema';
import {getAdmin,noCache} from '../../../../store-server';
import {serializeOrder,orderMessage,whatsapp} from '../../../../orders-server';
import {createProforma} from '../../../../pdf/proforma';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!await getAdmin()||(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin))return Response.json({error:'Admin sign-in required.'},{status:403,headers:noCache});
 const {id}=await params;const row=(await getDb().select().from(orders).where(eq(orders.id,id)))[0];if(!row)return Response.json({error:'Order not found.'},{status:404});
 const o=serializeOrder(row);if(o.status==='deleted'||o.status==='cancelled')return Response.json({error:'Reopen this order to create a pro forma.'},{status:409});
 if(!env.BUCKET)return Response.json({error:'PDF storage is unavailable. Try again.'},{status:503});
 const fileId=crypto.randomUUID(),reference=o.number+'-R'+o.revision;
 const pdf=await createProforma({reference,issuedAt:new Date().toISOString(),customerName:o.customerName,lines:o.lines,total:o.total});
 await env.BUCKET.put('proformas/'+fileId+'.pdf',pdf,{httpMetadata:{contentType:'application/pdf'},customMetadata:{reference}});
 const pdfUrl=new URL('/api/proformas/'+fileId+'.pdf',req.url).href;return Response.json({pdfUrl,reference,whatsappUrl:whatsapp(orderMessage(o,pdfUrl))},{headers:noCache});
}

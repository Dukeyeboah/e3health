import {z} from 'zod';
import {eq} from 'drizzle-orm';
import {getDb} from '../../../db';
import {orders} from '../../../db/schema';
import {getStoreProducts,noCache} from '../../store-server';
import {sellingPrice,isAvailable} from '../../product-types';
import {serializeOrder,orderMessage,whatsapp} from '../../orders-server';
import {orderTotal,type SavedLine} from '../../order-types';
const schema=z.object({submissionKey:z.string().uuid(),customerName:z.string().trim().max(100).default(''),expectedTotal:z.number().finite().nonnegative(),items:z.array(z.object({id:z.string().max(100),quantity:z.number().int().min(1).max(100)})).min(1).max(50)});
export async function POST(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Not allowed'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Check your order and choose quantities from 1 to 100.'},{status:400});
 const p=parsed.data,db=getDb();const quantities=new Map<string,number>();for(const l of p.items)quantities.set(l.id,(quantities.get(l.id)||0)+l.quantity);
 const requestHash=JSON.stringify({customerName:p.customerName,items:[...quantities].sort()});
 const respond=(row:typeof orders.$inferSelect)=>{if(row.requestHash!==requestHash)return Response.json({error:'Your cart changed. Please submit again.'},{status:409});const o=serializeOrder(row);const message=orderMessage(o);return Response.json({reference:o.number,total:o.total,lines:o.lines.map(({unitCost,...line})=>line),message,whatsappUrl:whatsapp(message)},{headers:noCache});};
 const existing=await db.select().from(orders).where(eq(orders.submissionKey,p.submissionKey));if(existing[0])return respond(existing[0]);
 const inventory=await getStoreProducts(),lines:SavedLine[]=[];
 for(const [id,quantity] of quantities){const product=inventory.find(x=>x.id===id);if(!product||!isAvailable(product)||product.stock<=0||quantity>100)return Response.json({error:'An item is unavailable or exceeds 100 units. Please update your cart.'},{status:409});const unitPrice=sellingPrice(product);lines.push({id,name:product.name,quantity,unitPrice,unitCost:product.cost,lineTotal:Math.round(unitPrice*100)*quantity/100,sample:!!product.sample});}
 const total=orderTotal(lines);if(Math.round(total*100)!==Math.round(p.expectedTotal*100))return Response.json({error:'Prices have changed. Review the updated total, then submit again.'},{status:409});
 const now=new Date().toISOString();await db.insert(orders).values({id:crypto.randomUUID(),submissionKey:p.submissionKey,requestHash,createdAt:now,updatedAt:now,data:JSON.stringify({customerName:p.customerName,lines,total,events:[{at:now,action:'Order submitted; WhatsApp handoff prepared'}]})}).onConflictDoNothing();
 const saved=await db.select().from(orders).where(eq(orders.submissionKey,p.submissionKey));return respond(saved[0]);
}

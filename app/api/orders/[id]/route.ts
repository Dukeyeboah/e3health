import {z} from 'zod';
import {and,eq} from 'drizzle-orm';
import {getDb} from '../../../../db';
import {orders,products} from '../../../../db/schema';
import {getAdmin,getStoreProducts,noCache} from '../../../store-server';
import {serializeOrder} from '../../../orders-server';
import {orderTotal,type SavedLine,type OrderData} from '../../../order-types';
const schema=z.object({revision:z.number().int(),status:z.enum(['new','completed','cancelled','deleted']).optional(),customerName:z.string().trim().max(100).optional(),lines:z.array(z.object({id:z.string().max(100),quantity:z.number().int().min(1).max(100),unitPrice:z.number().finite().min(0).max(1e9).multipleOf(.01)})).min(1).max(50).optional()});
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const admin=await getAdmin();
 if(!admin||(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin))return Response.json({error:'Admin sign-in required.'},{status:403,headers:noCache});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Check quantities and prices, then try again.'},{status:400});
 const {id}=await params,db=getDb(),p=parsed.data;const row=(await db.select().from(orders).where(eq(orders.id,id)))[0];if(!row)return Response.json({error:'Order not found.'},{status:404});
 const old=serializeOrder(row);if(old.revision!==p.revision)return Response.json({error:'This order changed elsewhere. Refresh orders and try again.'},{status:409});
 if(p.lines&&old.status!=='new')return Response.json({error:'Reopen this order before editing it.'},{status:409});
 let lines=old.lines;if(p.lines){if(new Set(p.lines.map(l=>l.id)).size!==p.lines.length)return Response.json({error:'Each product can appear only once.'},{status:400});const inventory=await getStoreProducts();lines=[];for(const l of p.lines){const previous=old.lines.find(x=>x.id===l.id),product=inventory.find(x=>x.id===l.id);if(!previous&&!product)return Response.json({error:'Product not found.'},{status:400});lines.push({...l,name:previous?.name||product!.name,unitCost:previous?.unitCost??product!.cost,sample:previous?.sample??!!product!.sample,lineTotal:Math.round(l.unitPrice*100)*l.quantity/100} as SavedLine);}}
 const now=new Date().toISOString(),status=p.status||old.status;
 const data:OrderData={customerName:p.customerName??old.customerName,lines,total:orderTotal(lines),events:[...old.events,{at:now,action:p.status?'Status changed to '+status+(status==='completed'&&!row.stockApplied?' · stock deducted':status!=='completed'&&row.stockApplied?' · stock restored':''):'Order details updated'}]};
 // Seed code-backed sample products only when needed. Existing stock is never overwritten.
 const stockApplied=status==='completed'?1:0;
 if(stockApplied&&!row.stockApplied){const inventory=await getStoreProducts();for(const line of lines){const product=inventory.find(p=>p.id===line.id);if(!product)return Response.json({error:line.name+' is no longer in the inventory. Reopen and edit this order first.'},{status:409});await db.insert(products).values({id:product.id,owner:admin.userId,data:JSON.stringify(product)}).onConflictDoNothing();}}
 // SQLite triggers adjust every product in the same transaction as this guarded update.
 try{
 const updated=await db.update(orders).set({status,stockApplied,data:JSON.stringify(data),updatedAt:now,revision:old.revision+1}).where(and(eq(orders.id,id),eq(orders.revision,p.revision))).returning();if(!updated[0])return Response.json({error:'Order changed. Refresh and try again.'},{status:409});return Response.json(serializeOrder(updated[0]),{headers:noCache});
 }catch(error){if(stockError(error))return Response.json({error:'Not enough stock to complete this order. Update your stock or reduce the order quantities, then try again.'},{status:409});throw error;}
}

function stockError(error:unknown):boolean{for(let depth=0;error&&depth<6;depth++){if(String(error).includes('E3_INSUFFICIENT_STOCK'))return true;error=typeof error==='object'&&error!==null&&'cause' in error?error.cause:null;}return false;}

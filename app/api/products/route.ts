import { getDb } from '../../../db';
import { products, settings } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import {sellingPrice,isAvailable} from '../../product-types';
import {getAdmin,getStoreProducts,noCache} from '../../store-server';
const schema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(200),category:z.enum(['Cosmetics','Pharmaceuticals','Wellness','Other']),cost:z.number().finite().min(0).max(1e9),markup:z.number().finite().min(0).max(10000),stock:z.number().int().min(0).max(1e9),description:z.string().max(2000).default(''),expiry:z.string().refine(s=>s===''||/^\d{4}-\d{2}-\d{2}$/.test(s)).default(''),visible:z.boolean().default(true),imageUrl:z.string().max(300).refine(s=>s===''||/^\/api\/photos\/[a-zA-Z0-9-]+$/.test(s)||/^\/mock-products\/[a-zA-Z0-9_.-]+$/.test(s)).default(''),sample:z.boolean().default(false)});
export async function GET(req:Request) {
 const admin=await getAdmin(), customer=new URL(req.url).searchParams.get('customer')==='1';
 const data=await getStoreProducts();
 const publicData=data.filter(isAvailable).map(p=>({id:p.id,name:p.name,category:p.category,sellingPrice:sellingPrice(p),available:p.stock>0,stock:p.stock,imageUrl:p.imageUrl||'',sample:!!p.sample}));
 return Response.json({admin:!!admin&&!customer,canAdmin:!!admin,currency:'GHS',products:admin&&!customer?data:publicData},{headers:noCache});
}
export async function POST(req:Request) {if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Not allowed'},{status:403});
 const u=await getAdmin();if(!u)return Response.json({error:'Only the store admin can change products.'},{status:403,headers:noCache});
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return Response.json({error:'Check the product details and try again.'},{status:400});
 const p=parsed.data;const db=getDb();const existing=await db.select().from(products).where(eq(products.id,p.id));
 if(existing.length&&existing[0].owner!==u.userId)return Response.json({error:'Not allowed'},{status:403});
 await db.insert(products).values({id:p.id,owner:u.userId,data:JSON.stringify(p)}).onConflictDoUpdate({target:products.id,set:{data:JSON.stringify(p)}});
 await db.delete(settings).where(eq(settings.key,'deleted-product:'+p.id));
 return Response.json(p,{headers:noCache});
}
export async function DELETE(req:Request){if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Not allowed'},{status:403});const u=await getAdmin();if(!u)return Response.json({error:'Only the store admin can delete products.'},{status:403});const parsed=z.object({id:z.string()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Invalid product'},{status:400});await getDb().delete(products).where(and(eq(products.id,parsed.data.id),eq(products.owner,u.userId)));await getDb().insert(settings).values({key:'deleted-product:'+parsed.data.id,value:'1'}).onConflictDoNothing();return Response.json({ok:true},{headers:noCache});}

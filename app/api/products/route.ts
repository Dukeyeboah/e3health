import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { products } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
const productSchema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(200),category:z.enum(['Cosmetics','Pharmaceuticals','Wellness','Other']),cost:z.number().finite().min(0).max(1e9),markup:z.number().finite().min(0).max(10000),stock:z.number().int().min(0).max(1e9),description:z.string().max(2000),expiry:z.string().refine(s=>s===''||/^\d{4}-\d{2}-\d{2}$/.test(s)),visible:z.boolean()});
export async function GET() {
 const u = await getChatGPTUser(); if(!u) return Response.json({error:'Please sign in to load your inventory.'},{status:401});
 const rows = await getDb().select().from(products).where(eq(products.owner,u.userId));
 return Response.json(rows.map(r=>JSON.parse(r.data)));
}
export async function POST(req:Request) {
 const u=await getChatGPTUser(); if(!u) return Response.json({error:'Please sign in to save your products.'},{status:401});
 const parsed=productSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return Response.json({error:'Check the product details and try again.'},{status:400});
 const p=parsed.data; const clean=p;
 const db=getDb(); const existing=await db.select().from(products).where(eq(products.id,p.id));
 if(existing.length&&existing[0].owner!==u.userId) return Response.json({error:'Not allowed'},{status:403});
 await db.insert(products).values({id:p.id,owner:u.userId,data:JSON.stringify(clean)}).onConflictDoUpdate({target:products.id,set:{data:JSON.stringify(clean)}});
 return Response.json(clean);
}
export async function DELETE(req:Request){const u=await getChatGPTUser();if(!u)return new Response('Unauthorized',{status:401});const parsed=z.object({id:z.string()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return new Response('Invalid ID',{status:400});await getDb().delete(products).where(and(eq(products.id,parsed.data.id),eq(products.owner,u.userId)));return Response.json({ok:true});}

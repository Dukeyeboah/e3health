import { env } from 'cloudflare:workers';
import { getChatGPTUser } from './chatgpt-auth';
import { getDb } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
export async function getAdmin() {
 const user=await getChatGPTUser();
 const email=(env as unknown as Record<string,string>).E3_ADMIN_EMAIL;
 return user && email && user.email.toLowerCase()===email.toLowerCase() ? user : null;
}
export async function getCurrency(){const rows=await getDb().select().from(settings).where(eq(settings.key,'currency'));return rows[0]?.value||'GHS'}
export const noCache={'Cache-Control':'private, no-store'};

export async function getStoreProducts(){
 const {products}=await import('../db/schema');
 const {mockProducts}=await import('./data/mock-products');
 const rows=await getDb().select().from(products);
 const flags=await getDb().select().from(settings);
 const deleted=new Set(flags.filter(x=>x.key.startsWith('deleted-product:')).map(x=>x.key.slice(16)));
 const all=new Map(mockProducts.map(p=>[p.id,p]));
 for(const row of rows)all.set(row.id,JSON.parse(row.data));
 return Array.from(all.values()).filter(p=>!deleted.has(p.id));
}

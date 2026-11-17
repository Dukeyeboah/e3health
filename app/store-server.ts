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

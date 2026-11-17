import {getAdmin,noCache} from '../../store-server';
import {getDb} from '../../../db';
import {settings} from '../../../db/schema';
import {z} from 'zod';
export async function PUT(req:Request){if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Not allowed'},{status:403});if(!await getAdmin())return Response.json({error:'Not allowed'},{status:403});const p=z.object({currency:z.enum(['GHS','USD','GBP','EUR','NGN','KES','ZAR'])}).safeParse(await req.json().catch(()=>null));if(!p.success)return Response.json({error:'Choose a supported currency.'},{status:400});await getDb().insert(settings).values({key:'currency',value:p.data.currency}).onConflictDoUpdate({target:settings.key,set:{value:p.data.currency}});return Response.json(p.data,{headers:noCache});}

import {getAdmin,noCache} from '../../store-server';
import {getDb} from '../../../db';
import {orders} from '../../../db/schema';
import {desc} from 'drizzle-orm';
import {serializeOrder} from '../../orders-server';
export async function GET(){if(!await getAdmin())return Response.json({error:'Admin sign-in required.'},{status:403,headers:noCache});return Response.json({orders:(await getDb().select().from(orders).orderBy(desc(orders.sequence))).map(serializeOrder)},{headers:noCache});}

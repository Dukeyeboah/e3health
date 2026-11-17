import {env} from 'cloudflare:workers';
import {createProforma,type OrderLine} from '../../pdf/proforma';
import {z} from 'zod';
import {getStoreProducts,noCache} from '../../store-server';
import {sellingPrice,isAvailable} from '../../product-types';
const schema=z.object({items:z.array(z.object({id:z.string().max(100),quantity:z.number().int().min(1).max(100)})).min(1).max(50)});
export async function POST(req:Request){
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Add products with whole-number quantities from 1 to 100.'},{status:400});
 const inventory=await getStoreProducts();const quantities=new Map<string,number>();for(const line of parsed.data.items)quantities.set(line.id,(quantities.get(line.id)||0)+line.quantity);
 const lines:OrderLine[]=[];for(const [id,quantity] of quantities){const p=inventory.find(p=>p.id===id);if(!p||!isAvailable(p)||p.stock<=0||quantity>100)return Response.json({error:p?quantity>100?'The maximum is 100 units per product. Please update your cart.':`${p.name} is currently unavailable. Please remove it from your cart.`:'A product is no longer available. Please remove it from your cart.'},{status:409});const unitCents=Math.round(sellingPrice(p)*100);lines.push({id,name:p.name,quantity,unitPrice:unitCents/100,lineTotal:unitCents*quantity/100,sample:!!p.sample});}
 const totalCents=lines.reduce((n,p)=>n+Math.round(p.lineTotal*100),0);const cedis=(n:number)=>'GH₵ '+n.toFixed(2);
 const sample=lines.some(p=>p.sample);
 const id=crypto.randomUUID();const issuedAt=new Date().toISOString();const reference='E3-'+issuedAt.slice(0,10).replace(/-/g,'')+'-'+id.slice(0,8).toUpperCase();
 if(!env.BUCKET)return Response.json({error:'PDF storage is temporarily unavailable. Please try again.'},{status:503});
 const pdf=await createProforma({reference,issuedAt,lines,total:totalCents/100});
 await env.BUCKET.put('proformas/'+id+'.pdf',pdf,{httpMetadata:{contentType:'application/pdf'},customMetadata:{reference}});
 const pdfUrl=new URL('/api/proformas/'+id+'.pdf',req.url).href;
 const message=[sample?'*E3Health — SAMPLE ORDER*':'*E3Health — Order request*','',...lines.map((p,i)=>`${i+1}. ${p.name.replace(/[\r\n\t]/g,' ')}\n${p.quantity} × ${cedis(p.unitPrice)} = ${cedis(p.lineTotal)}`),'',`*Total: ${cedis(totalCents/100)}*`,'',`Pro forma PDF: ${pdfUrl}`,'',sample?'Contains demo products and illustrative prices. Please confirm actual availability and pricing.':'Please confirm availability and any delivery charges.'].join('\n');
 return Response.json({lines,total:totalCents/100,currency:'GHS',reference,pdfUrl,message,whatsappUrl:'https://wa.me/233243440226?text='+encodeURIComponent(message)},{headers:noCache});
}

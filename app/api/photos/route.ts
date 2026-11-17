import {env} from 'cloudflare:workers';
import {getAdmin,noCache} from '../../store-server';
export async function POST(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Not allowed'},{status:403});
 if(!await getAdmin())return Response.json({error:'Only the store admin can upload photos.'},{status:403});
 if(Number(req.headers.get('content-length'))>6*1024*1024)return Response.json({error:'Choose a photo smaller than 5 MB.'},{status:413});
 const form=await req.formData().catch(()=>null);const file=form?.get('photo');
 if(!file||typeof file==='string'||!('arrayBuffer'in file)||file.size>5*1024*1024||file.size===0)return Response.json({error:'Choose a JPG, PNG or WebP photo under 5 MB.'},{status:400});
 const bytes=new Uint8Array(await file.arrayBuffer());
 const mime=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
 if(!mime)return Response.json({error:'This photo format is not supported. Choose JPG, PNG or WebP.'},{status:400});
 if(!env.BUCKET)return Response.json({error:'Photo storage is temporarily unavailable.'},{status:503});
 const id=crypto.randomUUID();await env.BUCKET.put('products/'+id,bytes,{httpMetadata:{contentType:mime}});
 return Response.json({imageUrl:'/api/photos/'+id},{headers:noCache});
}

import {mockProducts} from '../app/data/mock-products';
import {sellingPrice,isAvailable,type Product} from '../app/product-types';
import {orderTotal,type SavedOrder,type SavedLine} from '../app/order-types';
import type {StoreApi} from '../app/store-runtime';
type DemoOrder=SavedOrder&{submissionKey?:string;stockApplied:boolean};
export type DemoState={products:Product[];orders:DemoOrder[];nextNumber:number;deletedProducts:string[]};
export function initialState():DemoState{
 const products=structuredClone(mockProducts),now=new Date().toISOString();
 const line=(index:number,quantity:number):SavedLine=>{const p=products[index],unitPrice=sellingPrice(p);return {id:p.id,name:p.name,quantity,unitPrice,unitCost:p.cost,lineTotal:Math.round(unitPrice*100)*quantity/100,sample:true}};
 const make=(number:number,name:string,lines:SavedLine[],status:SavedOrder['status']):DemoOrder=>({id:crypto.randomUUID(),number:'DEMO-'+String(number).padStart(4,'0'),customerName:name,lines,total:orderTotal(lines),status,stockApplied:status==='completed',revision:1,createdAt:now,updatedAt:now,events:[{at:now,action:'Example demo order'}]});
 const orders=[make(2,'Ama · example',[line(0,2),line(7,1)],'new'),make(1,'Akosua · example',[line(3,2)],'completed')];
 products[3].stock-=2;return {products,orders,nextNumber:3,deletedProducts:[]};
}
export type DemoStorage={change:<T>(action:(state:DemoState)=>T)=>Promise<T>};
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('e3health-demo-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('store');req.onsuccess=()=>resolve(req.result);req.onerror=()=>{database=undefined;reject(Error('Demo storage is unavailable. Enable browser storage and try again.'))}})}
export const browserStorage:DemoStorage={async change<T>(action:(state:DemoState)=>T){const database=await db();return new Promise<T>((resolve,reject)=>{const tx=database.transaction('store','readwrite'),store=tx.objectStore('store');let result:T;let failure:unknown;const req=store.get('inventory');req.onsuccess=()=>{try{const state=(req.result||initialState()) as DemoState;result=action(state);store.put(state,'inventory')}catch(error){failure=error;tx.abort()}};tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(failure||Error('Could not save this demo. Browser storage may be full. Try a smaller photo.'));})}};
const reply=(data:unknown,status=200)=>Response.json(data,{status});
function check(condition:unknown,message:string):asserts condition{if(!condition)throw Error(message)}
function validLines(lines:SavedLine[]){check(lines.length>0&&lines.length<=50,'Keep between 1 and 50 products in the order.');check(new Set(lines.map(l=>l.id)).size===lines.length,'Each product can appear once.');for(const l of lines)check(Number.isInteger(l.quantity)&&l.quantity>=1&&l.quantity<=100&&Number.isFinite(l.unitPrice)&&l.unitPrice>=0,'Use quantities from 1 to 100 and valid prices.');}
export function createDemoApi(storage:DemoStorage=browserStorage):StoreApi{return async(path,init={})=>{
 try{
 const url=new URL(path,'https://demo.local'),method=init.method||'GET';
 if(url.pathname==='/api/photos'&&method==='POST'){
  const file=(init.body as FormData).get('photo');check(file instanceof Blob&&file.size<=5*1024*1024,'Choose a photo under 5 MB.');
  const imageUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Could not read this photo.'));reader.readAsDataURL(file)});return reply({imageUrl});
 }
 if(/^\/api\/orders\/[^/]+\/proforma$/.test(url.pathname)&&method==='POST'){
  const id=url.pathname.split('/')[3];const order=await storage.change(s=>structuredClone(s.orders.find(o=>o.id===id)));check(order,'Order not found.');check(order.status==='new'||order.status==='completed','Reopen this order first.');
  const {createProforma}=await import('../app/pdf/proforma');const reference=order.number+'-R'+order.revision;const bytes=await createProforma({reference,issuedAt:new Date().toISOString(),customerName:order.customerName,lines:order.lines.map(l=>({...l,sample:true})),total:order.total});const pdfUrl=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));return reply({reference,pdfUrl,whatsappUrl:''});
 }
 const body=typeof init.body==='string'?JSON.parse(init.body):{};
 const result=await storage.change(s=>{
 if(url.pathname==='/api/products'){
  if(method==='GET'){const products=s.products.filter(p=>!s.deletedProducts.includes(p.id));const customer=url.searchParams.get('customer')==='1';return {admin:!customer,canAdmin:true,currency:'GHS',products:customer?products.filter(isAvailable).map(p=>({id:p.id,name:p.name,category:p.category,sellingPrice:sellingPrice(p),stock:p.stock,available:p.stock>0,imageUrl:p.imageUrl,sample:true})):products};}
  if(method==='POST'){const p=body as Product;check(p.id&&p.name.trim()&&Number.isInteger(p.stock)&&p.stock>=0&&Number.isFinite(p.cost)&&p.cost>=0&&Number.isFinite(p.markup)&&p.markup>=0,'Check the product details.');p.sample=true;s.products=[...s.products.filter(x=>x.id!==p.id),p];s.deletedProducts=s.deletedProducts.filter(id=>id!==p.id);return p;}
  if(method==='DELETE'){s.deletedProducts=[...new Set([...s.deletedProducts,body.id])];return {ok:true};}
 }
 if(url.pathname==='/api/orders'&&method==='GET')return {orders:s.orders};
 if(url.pathname==='/api/order'&&method==='POST'){
  let order=s.orders.find(o=>o.submissionKey===body.submissionKey);
  if(!order){check(typeof body.submissionKey==='string','Please try submitting again.');check(Array.isArray(body.items)&&body.items.length,'Add a product first.');const lines:SavedLine[]=body.items.map((item:{id:string;quantity:number})=>{const p=s.products.find(p=>p.id===item.id&&!s.deletedProducts.includes(p.id));check(p&&p.stock>0&&isAvailable(p),'A product is unavailable.');const unitPrice=sellingPrice(p);return {id:p.id,name:p.name,quantity:item.quantity,unitPrice,unitCost:p.cost,lineTotal:Math.round(unitPrice*100)*item.quantity/100,sample:true}});validLines(lines);const total=orderTotal(lines);check(Math.round(total*100)===Math.round(body.expectedTotal*100),'Prices changed. Review the total and try again.');const now=new Date().toISOString();order={id:crypto.randomUUID(),number:'DEMO-'+String(s.nextNumber++).padStart(4,'0'),customerName:String(body.customerName||'').slice(0,100),lines,total,status:'new',revision:1,createdAt:now,updatedAt:now,submissionKey:body.submissionKey,stockApplied:false,events:[{at:now,action:'Demo order submitted'}]};s.orders.unshift(order);}
  return {reference:order.number,total:order.total,lines:order.lines,message:'Demo order saved in this browser.',whatsappUrl:''};
 }
 if(/^\/api\/orders\/[^/]+$/.test(url.pathname)&&method==='PATCH'){
  const o=s.orders.find(o=>o.id===url.pathname.split('/')[3]);check(o,'Order not found.');check(o.revision===body.revision,'This order changed. Refresh and try again.');
  if(body.lines){check(o.status==='new','Reopen the order before editing.');const lines:SavedLine[]=body.lines.map((l:SavedLine)=>{const previous=o.lines.find(x=>x.id===l.id),p=s.products.find(p=>p.id===l.id);check(previous||p,'Product not found.');return {...l,name:previous?.name||p!.name,unitCost:previous?.unitCost??p!.cost,lineTotal:Math.round(l.unitPrice*100)*l.quantity/100,sample:true}});validLines(lines);o.lines=lines;o.total=orderTotal(lines);}
  if(body.customerName!==undefined)o.customerName=String(body.customerName).slice(0,100);
  if(body.status){check(['new','completed','cancelled','deleted'].includes(body.status),'Choose a valid status.');if(body.status==='completed'&&!o.stockApplied){for(const l of o.lines){const p=s.products.find(p=>p.id===l.id);check(p&&!s.deletedProducts.includes(p.id)&&p.stock>=l.quantity,'Not enough stock. Update stock or reduce the quantity.');}for(const l of o.lines)s.products.find(p=>p.id===l.id)!.stock-=l.quantity;o.stockApplied=true;}else if(body.status!=='completed'&&o.stockApplied){for(const l of o.lines)s.products.find(p=>p.id===l.id)!.stock+=l.quantity;o.stockApplied=false;}o.status=body.status;}
  o.updatedAt=new Date().toISOString();o.revision++;o.events.push({at:o.updatedAt,action:body.status?'Status changed to '+o.status:'Order details updated'});return o;
 }
 throw Error('This action is not available in the demo.');
 });return reply(result);
 }catch(error){return reply({error:error instanceof Error?error.message:'Could not save the demo. Please try again.'},400)}
}}

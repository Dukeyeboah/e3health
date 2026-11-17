export type Product={id:string;name:string;category:string;cost:number;markup:number;stock:number;description:string;expiry:string;visible:boolean;imageUrl?:string;sample?:boolean};
export type PublicProduct={id:string;name:string;category:string;sellingPrice:number;available:boolean;stock:number;imageUrl?:string;sample?:boolean};
export const sellingPrice=(p:Product)=>Math.round(p.cost*(1+p.markup/100)*100)/100;
export const isAvailable=(p:Product)=>p.visible&&(!p.expiry||p.expiry>=new Date().toISOString().slice(0,10));

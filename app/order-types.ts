export type SavedLine={id:string;name:string;quantity:number;unitPrice:number;unitCost:number;lineTotal:number;sample:boolean};
export type OrderData={customerName:string;lines:SavedLine[];total:number;events:{at:string;action:string}[]};
export type SavedOrder=OrderData&{id:string;number:string;createdAt:string;updatedAt:string;status:'new'|'completed'|'cancelled'|'deleted';revision:number};
export const orderTotal=(lines:SavedLine[])=>lines.reduce((sum,p)=>sum+Math.round(p.unitPrice*100)*p.quantity,0)/100;

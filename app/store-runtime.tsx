'use client';
import {createContext,useContext} from 'react';
export type StoreApi=(path:string,init?:RequestInit)=>Promise<Response>;
export const StoreRuntime=createContext<{api:StoreApi;demo:boolean}>({api:(path,init)=>fetch(path,init),demo:false});
export const useStoreRuntime=()=>useContext(StoreRuntime);

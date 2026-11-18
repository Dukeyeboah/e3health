import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import {StoreRuntime} from '../app/store-runtime';
import {createDemoApi} from './demo-store';
import '../app/globals.css';
const api=createDemoApi();
createRoot(document.getElementById('root')!).render(<StoreRuntime.Provider value={{api,demo:true}}><Home/></StoreRuntime.Provider>);

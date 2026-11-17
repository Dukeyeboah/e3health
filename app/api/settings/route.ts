import {getAdmin,noCache} from '../../store-server';
export async function PUT(){if(!await getAdmin())return Response.json({error:'Not allowed'},{status:403});return Response.json({currency:'GHS'},{headers:noCache});}

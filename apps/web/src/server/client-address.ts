import {isIP} from 'node:net';

/** Railway documents X-Real-IP. Trust only with an origin exclusively behind its edge. */
export function clientAddress(request:Request,adapterAddress:string):string{
  if(process.env.TRUST_RAILWAY_PROXY==='true'){
    const address=request.headers.get('x-real-ip')?.trim();
    if(address&&isIP(address))return address;
  }
  return adapterAddress;
}

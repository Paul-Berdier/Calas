import type {APIRoute} from 'astro';
import {configurationProblems,checkServices} from '../../server/config';
export const GET:APIRoute=async()=>{
 try{if(configurationProblems().length)throw new Error('Configuration');await checkServices();return Response.json({status:'ready'},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
};

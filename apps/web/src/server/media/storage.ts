import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectsCommand,HeadBucketCommand,ListObjectsV2Command} from '@aws-sdk/client-s3';

export interface MediaStorage {
  put(key:string,body:Uint8Array,mimeType:string):Promise<void>;
  get(key:string):Promise<Uint8Array>;
  remove(keys:string[]):Promise<void>;
  check():Promise<void>;
  list():Promise<Array<{key:string;size:number;etag?:string}>>;
}
function assertKey(key:string){
  if(!/^media\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:original\.(?:jpg|png|pdf)|(?:320|960|1920)\.webp)$/.test(key))throw new Error('Invalid media storage key.');
}
/** A private bucket is required. No public ACL, public URL or signed URL is
 * returned to clients; reads pass through the application publication gate. */
export class S3MediaStorage implements MediaStorage {
  private client:S3Client;
  private bucket:string;
  constructor(config:{endpoint:string;region:string;bucket:string;accessKeyId:string;secretAccessKey:string;forcePathStyle?:boolean}){
    const url=new URL(config.endpoint);
    if(url.username||url.password||!['https:','http:'].includes(url.protocol))throw new Error('Invalid S3 endpoint.');
    if(url.protocol==='http:'&&!['localhost','127.0.0.1','minio'].includes(url.hostname))throw new Error('HTTPS is required for remote storage.');
    if(!config.bucket||!config.accessKeyId||!config.secretAccessKey)throw new Error('Media storage is not configured.');
    this.bucket=config.bucket;
    this.client=new S3Client({endpoint:url.href,region:config.region,forcePathStyle:config.forcePathStyle??false,
      credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},maxAttempts:2,
      requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
  }
  async put(key:string,body:Uint8Array,mimeType:string){
    assertKey(key);
    await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:body,ContentType:mimeType,CacheControl:'private, no-store'}),{abortSignal:AbortSignal.timeout(30_000)});
  }
  async get(key:string){
    assertKey(key);
    const response=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:key}),{abortSignal:AbortSignal.timeout(15_000)});
    if(!response.Body)throw new Error('Media object missing.');
    if((response.ContentLength??0)>24*1024*1024)throw new Error('Unexpected object size.');
    return response.Body.transformToByteArray();
  }
  async remove(keys:string[]){
    const unique=[...new Set(keys)];unique.forEach(assertKey);
    if(!unique.length)return;
    const result=await this.client.send(new DeleteObjectsCommand({Bucket:this.bucket,Delete:{Objects:unique.map(Key=>({Key})),Quiet:true}}),{abortSignal:AbortSignal.timeout(15_000)});
    if(result.Errors?.length)throw new Error('Media cleanup was not confirmed.');
  }
  async check(){await this.client.send(new HeadBucketCommand({Bucket:this.bucket}),{abortSignal:AbortSignal.timeout(5000)});}
  async list(){
    const objects:Array<{key:string;size:number;etag?:string}>=[];let continuation:string|undefined;
    do{
      const result=await this.client.send(new ListObjectsV2Command({Bucket:this.bucket,ContinuationToken:continuation}),{abortSignal:AbortSignal.timeout(15_000)});
      for(const item of result.Contents??[]){if(!item.Key)continue;objects.push({key:item.Key,size:item.Size??0,etag:item.ETag});}
      continuation=result.IsTruncated?result.NextContinuationToken:undefined;
      if(objects.length>100_000||result.IsTruncated&&!continuation)throw new Error('Storage inventory is too large or incomplete.');
    }while(continuation);
    return objects;
  }
}
let configured:MediaStorage|undefined;
export function getMediaStorage():MediaStorage{
  configured??=new S3MediaStorage({endpoint:process.env.S3_ENDPOINT??'',region:process.env.S3_REGION??'auto',bucket:process.env.S3_BUCKET??'',accessKeyId:process.env.S3_ACCESS_KEY_ID??'',secretAccessKey:process.env.S3_SECRET_ACCESS_KEY??'',forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true'});
  return configured;
}

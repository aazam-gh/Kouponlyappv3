import { supabase } from '@/lib/supabase';

type StorageRef={bucket:string;path:string};
function fromUrl(value: string): StorageRef | null {
  try {
    const url=new URL(value);
    const marker='/storage/v1/object/';
    const index=url.pathname.indexOf(marker);
    if(index<0)return null;
    const suffix=url.pathname.slice(index+marker.length).split('/');
    if(suffix[0]==='public'||suffix[0]==='sign'||suffix[0]==='authenticated')suffix.shift();
    const bucket=decodeURIComponent(suffix.shift()||'');
    return bucket?{bucket,path:suffix.map(decodeURIComponent).join('/')}:null;
  } catch { return null; }
}
export function ref(_storage: unknown,path: string):StorageRef {
  const remote=fromUrl(path);
  if(remote)return remote;
  if(path.startsWith('realx-student-documents/'))return {bucket:'realx-student-documents',path:path.slice('realx-student-documents/'.length)};
  if(path.startsWith('realx-public-media/'))return {bucket:'realx-public-media',path:path.slice('realx-public-media/'.length)};
  if(path.startsWith('verification_requests/'))return {bucket:'realx-student-documents',path};
  return {bucket:'realx-public-media',path:path.replace(/^\/+/,'')};
}
export async function deleteObject(reference:StorageRef) {
  const {error}=await supabase.storage.from(reference.bucket).remove([reference.path]);
  if(error)throw error;
}
export async function getDownloadURL(reference:StorageRef) {
  const bucket=supabase.storage.from(reference.bucket);
  if(reference.bucket==='realx-public-media')return bucket.getPublicUrl(reference.path).data.publicUrl;
  const {data,error}=await bucket.createSignedUrl(reference.path,3600);
  if(error)throw error;
  return data.signedUrl;
}
async function convertPublicImageToWebp(reference:StorageRef,file:Blob) {
  if(reference.bucket!=='realx-public-media'||!/^image\/(jpeg|png)$/i.test(file.type)||typeof createImageBitmap==='undefined'||typeof document==='undefined')return file;
  try {
    const bitmap=await createImageBitmap(file);
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const context=canvas.getContext('2d');if(!context){bitmap.close();return file;}
    context.drawImage(bitmap,0,0);bitmap.close();
    const converted=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.8));
    return converted?.type==='image/webp'?converted:file;
  } catch { return file; }
}
export function uploadBytesResumable(reference:StorageRef,file:Blob,metadata?:{contentType?:string;cacheControl?:string}) {
  const task:any={
    snapshot:{ref:reference,bytesTransferred:0,totalBytes:file.size,state:'running'},
    on(_event:string,progress?:(snapshot:any)=>void,error?:(error:any)=>void,complete?:()=>void|Promise<void>) {
      void (async()=>{
        const upload=await convertPublicImageToWebp(reference,file);
        const result=await supabase.storage.from(reference.bucket).upload(reference.path,upload,{
          contentType:upload.type||metadata?.contentType,cacheControl:metadata?.cacheControl,upsert:true,
        });
        if(result.error)throw result.error;
        task.snapshot={ref:reference,bytesTransferred:upload.size,totalBytes:upload.size,state:'success'};
        progress?.(task.snapshot);await complete?.();
      })().catch((uploadError)=>error?.(uploadError));
      return ()=>{};
    },
  };
  return task;
}

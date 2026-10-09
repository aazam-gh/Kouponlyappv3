import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import type {StorageAsset} from '@/lib/cloud.types';

const extension=(name:string|undefined,mime:string)=>name?.split('.').pop()?.toLowerCase()??(mime.includes('video')?'mp4':mime.includes('png')?'png':'jpg');
const toAsset=(userId:string,picked:ImagePicker.ImagePickerAsset):StorageAsset=>{
  const id=Crypto.randomUUID();const mimeType=picked.mimeType??'image/jpeg';const ext=extension(picked.fileName??undefined,mimeType);const path=`${userId}/avatar-${id}.${ext}`;
  return{id,bucket:'avatars',path,uri:picked.uri,mimeType,byteSize:picked.fileSize??1,mediaType:'image',progress:0,status:'selected'};
};
export async function pickAvatar(userId:string){const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.86});if(result.canceled)return null;const asset=toAsset(userId,result.assets[0]);if(asset.byteSize>5*1024*1024)throw new Error('Profile photos must be smaller than 5 MB.');return asset;}

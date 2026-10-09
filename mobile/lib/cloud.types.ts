import type { Category, Deal, DirectoryItem, HeroSlide, Reward } from '@/lib/data';

export type SyncStatus='guest'|'loading-cloud'|'synced'|'syncing'|'offline'|'conflict'|'error';
export type MutationKind='save-deal'|'save-offer'|'interest'|'preferences'|'profile';
export type PendingMutation={id:string;userId:string;kind:MutationKind;entityId:string;operation:'upsert'|'delete';payload:Record<string,unknown>;createdAt:number;attempts:number};
export type RealtimeEvent={table:string;eventType:'INSERT'|'UPDATE'|'DELETE'|'*';receivedAt:number};
export type StorageAsset={id:string;bucket:'avatars';path:string;uri:string;mimeType:string;byteSize:number;mediaType:'image'|'video';progress:number;status:'selected'|'uploading'|'uploaded'|'failed';error?:string};
export type CloudCatalogue={deals:Deal[];offers:DirectoryItem[];partners:DirectoryItem[];categories:Category[];heroSlides:HeroSlide[];rewards:Reward[];source:'cloud';updatedAt:number};
export type EdgeError={error:{code:string;message:string}};
export type EdgeResult<T>={data:T};

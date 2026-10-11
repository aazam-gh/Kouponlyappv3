import { supabase } from '@/lib/supabase';

type Ref = { kind: 'collection' | 'document'; table: string; id?: string; filters?: Constraint[]; order?: { field: string; direction: 'asc'|'desc' }[]; take?: number; parentStudentId?: string };
type Constraint = { kind: 'where'; field: string; op: string; value: unknown } | { kind: 'order'; field: string; direction: 'asc'|'desc' } | { kind: 'limit'; value: number } | { kind: 'cursor'; document?: Snap; values?: unknown[] };
type Snap = { id: string; exists: () => boolean; data: () => any; get: (key: string) => any; ref: Ref };
type QuerySnap = { docs: Snap[]; size: number; empty: boolean; forEach: (callback: (doc: Snap) => void) => void };
export type DocumentData = Record<string, any>;
export type QueryConstraint = Constraint;
export type QueryDocumentSnapshot<T = DocumentData> = Snap & { data: () => T };
export type DocumentReference<T = DocumentData> = Ref & { __type?: T };
export type CollectionReference<T = DocumentData> = Ref & { __type?: T };

const tableFor: Record<string,string> = {
  students:'couponly_students', vendors:'couponly_vendors', transactions:'couponly_transactions',
  categories:'couponly_categories', universities:'couponly_universities', events:'couponly_events',
  banners:'couponly_banners', featuredBrandShowcase:'couponly_featured_brands',
  trendingOfferBanners:'couponly_trending_offer_banners', notifications:'couponly_notifications', cms:'couponly_cms_documents',
  verification_requests:'couponly_verification_requests',
  opportunities:'couponly_opportunities', mapLocations:'couponly_map_locations', maps:'couponly_map_cache',
  opportunityActionConfigs:'couponly_opportunity_action_configs', opportunityActionRequests:'couponly_opportunity_action_requests',
  opportunityAnalytics:'couponly_opportunity_analytics',
  onboarding_analytics:'couponly_onboarding_analytics', rewardAccounts:'couponly_reward_accounts',
  creator_codes:'couponly_creator_codes',
  pushTokens:'couponly_push_tokens',
};


export class Timestamp {
  constructor(private readonly date: Date) {}
  toDate() { return this.date; }
  toMillis() { return this.date.getTime(); }
  static fromDate(value: Date) { return new Timestamp(value); }
  static fromMillis(value: number) { return new Timestamp(new Date(value)); }
}
export const serverTimestamp = () => new Date().toISOString();
export const deleteField = () => null;

const snake = (value: string) => value.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
const camel = (value: string) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const fieldFor = (table: string, field: string) => {
  const overrides: Record<string,Record<string,string>> = {
    couponly_students:{uid:'id',role:'account_role',accountRole:'account_role',firstName:'first_name',lastName:'last_name',universityId:'university_id',creatorCode:'creator_code'},
    couponly_vendors:{vendorId:'id',userId:'user_id',categoryId:'category_id',catalogueDealId:'catalogue_deal_id',vendorType:'vendor_type',logoPath:'logo_path',place:'place_label',imageUrl:'image_url',coverImage:'cover_image_url',distanceKm:'distance_km',savingLabel:'saving_label',offerValue:'offer_value',sortOrder:'sort_order',businessHours:'business_hours',galleryImages:'gallery_images'},
    couponly_transactions:{transactionId:'id',studentId:'student_id',uid:'student_id',vendorId:'vendor_id',offerId:'offer_id',transactionType:'transaction_type',createdAt:'created_at'},
    couponly_student_saved_items:{studentId:'student_id',itemId:'item_id',itemType:'item_type'},
    couponly_verification_requests:{verificationRequestId:'id',studentId:'student_id',submittedAt:'submitted_at',reviewedAt:'reviewed_at',rejectionReason:'rejection_reason'},
    couponly_map_locations:{vendorId:'vendor_id'},
    couponly_featured_brands:{vendorId:'vendor_id'}, couponly_trending_offer_banners:{offerId:'offer_id'},
    couponly_notifications:{recipientId:'recipient_id',sentAt:'sent_at'},
    couponly_opportunities:{categoryId:'category_id',startsAt:'starts_at',endsAt:'ends_at'},
    couponly_opportunity_action_requests:{studentId:'student_id',opportunityId:'opportunity_id'},
  };
  return overrides[table]?.[field] || snake(field);
};
const selectFor = (table: string) => table === 'couponly_categories' ? '*,couponly_subcategories(*)'
  : table === 'couponly_vendors' ? '*,couponly_categories(name),couponly_vendor_subcategories(subcategory_id,couponly_subcategories(name))' : '*';
const idFieldFor = (_table: string) => 'id';
const payloadlessTables = new Set([
  'couponly_notifications','couponly_verification_requests','couponly_push_tokens','couponly_creator_codes',
]);
const asIso = (value: any) => value instanceof Timestamp ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value;
function clean(value: any): any {
  if (value instanceof Timestamp || value instanceof Date) return asIso(value);
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/(?:_ar|Ar|Arabic)$/.test(key)).map(([key,item])=>[key,clean(item)]));
  return value;
}
function collectionRef(tableName: string, parentStudentId?: string): Ref {
  const table = tableFor[tableName] || (tableName.startsWith('couponly_') ? tableName : 'couponly_' + snake(tableName));
  return {kind:'collection',table,filters:parentStudentId?[{kind:'where',field:'student_id',op:'==',value:parentStudentId}]:[],parentStudentId};
}
export function collection(_db: unknown, ...segments: string[]): Ref {
  if (segments.length >= 3 && segments[0] === 'students' && segments[2] === 'savedItems') return collectionRef('couponly_student_saved_items',segments[1]);
  return collectionRef(segments.at(-1) || '');
}
export function doc(_db: unknown, ...segments: string[]): Ref {
  if (segments.length === 1 && segments[0].includes('/')) {
    const [collectionName, ...rest] = segments[0].split('/');
    return {...collectionRef(collectionName === 'meta' ? 'maps' : collectionName),kind:'document',id:rest.join('/')};
  }
  if (segments.length >= 4 && segments[0] === 'students' && segments[2] === 'savedItems') return {...collectionRef('couponly_student_saved_items',segments[1]),kind:'document',id:segments[3]};
  return {...collectionRef(segments.at(-2)||''),kind:'document',id:segments.at(-1)};
}
export function where(field: string, op: string, value: unknown): Constraint { return {kind:'where',field,op,value}; }
export function orderBy(field: string, direction: 'asc'|'desc' = 'asc'): Constraint { return {kind:'order',field,direction}; }
export function limit(value: number): Constraint { return {kind:'limit',value}; }
export function startAfter(...values: unknown[]): Constraint {
  const document=values[0] && typeof values[0]==='object' && 'data' in (values[0] as any) ? values[0] as Snap : undefined;
  return {kind:'cursor',document,values:document?undefined:values};
}
export function query(ref: Ref, ...constraints: Constraint[]): Ref {
  return {...ref,filters:[...(ref.filters||[]),...constraints.filter(c=>c.kind==='where'||c.kind==='cursor')],order:constraints.filter((c):c is Extract<Constraint,{kind:'order'}>=>c.kind==='order').map(c=>({field:c.field,direction:c.direction})),take:constraints.find((c):c is Extract<Constraint,{kind:'limit'}>=>c.kind==='limit')?.value};
}
function normalize(row: any, ref: Ref) {
  if (!row) return {};
  const payload = row.payload || row.profile || row.settings || {};
  const data: any = clean(payload);
  for (const [key,value] of Object.entries(row)) {
    if (['payload','profile','settings','couponly_subcategories','couponly_categories','couponly_vendor_subcategories'].includes(key)) continue;
    data[camel(key)] = value;
  }
  data.id = row.id;
  if (ref.table==='couponly_students') { data.uid=row.id; data.firstName=data.firstName ?? ''; data.lastName=data.lastName ?? ''; data.role=data.role ?? data.accountRole; }
  if (ref.table==='couponly_categories') {
    data.nameEnglish=row.name;
    data.imageUrl=data.imageUrl ?? row.image_path ?? '';
    data.subcategories=(row.couponly_subcategories || []).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((sub:any)=>({id:sub.id,nameEnglish:sub.name,imageUrl:sub.image_path || ''}));
    data.order=Number(data.order ?? row.sort_order ?? 0);
  }
  if (ref.table==='couponly_vendors') {
    data.vendorId=row.id;
    data.mainCategory=row.couponly_categories?.name ?? data.mainCategory;
    data.subcategory=(row.couponly_vendor_subcategories || []).map((link:any)=>link.couponly_subcategories?.name).filter(Boolean);
    data.catalogueDealId=row.catalogue_deal_id;
    data.profilePicture=row.logo_path ?? data.profilePicture;
    data.shortDescription=row.description ?? data.shortDescription;
    data.isTrending=Number(row.trend)>0;
    data.place=row.place_label ?? data.place;
    data.distanceKm=row.distance_km ?? data.distanceKm;
    data.savingLabel=row.saving_label ?? data.savingLabel;
    data.offerValue=row.offer_value ?? data.offerValue;
    data.imageUrl=row.image_url ?? data.imageUrl;
    data.coverImage=row.cover_image_url ?? data.coverImage;
  }
  if (ref.table==='couponly_transactions') data.transactionId=row.id;
  if (ref.table==='couponly_verification_requests') data.verificationRequestId=row.id;
  return data;
}
function snapshot(row: any, ref: Ref): Snap {
  const exists=Boolean(row);
  const data=normalize(row,ref);
  return {id:String(row?.id ?? ref.id ?? ''),exists:()=>exists,data:()=>data,get:(key:string)=>data[key],ref};
}
function querySnapshot(rows: any[], ref: Ref): QuerySnap {
  const docs=rows.map(row=>snapshot(row,ref));
  return {docs,size:docs.length,empty:docs.length===0,forEach:callback=>docs.forEach(callback)};
}
function applyConstraint(builder: any, table: string, c: Constraint) {
  if (c.kind==='where') {
    const field=fieldFor(table,c.field);
    const operator: Record<string,string>={'==':'eq','!=':'neq','>':'gt','>=':'gte','<':'lt','<=':'lte','array-contains':'cs','in':'in'};
    const op=operator[c.op] || c.op;
    if (['id','name','status','email','active','published','vendor_id','student_id','created_at','submitted_at','starts_at','ends_at','sent_at','sort_order','account_role','transaction_type','offer_id','category_id','university_id','item_type','item_id','role','latitude','longitude'].includes(field)) {
      const value = c.value instanceof Timestamp ? c.value.toDate().toISOString() : c.value;
      return builder.filter(field,op,value as any);
    }
    return builder.filter('payload->>' + c.field,op,String(c.value));
  }
  return builder;
}
async function getRows(ref: Ref) {
  let q: any=supabase.from(ref.table).select(selectFor(ref.table));
  for (const c of ref.filters||[]) {
    if(c.kind==='cursor'){
      const ordering=ref.order?.[0];
      const field=ordering?fieldFor(ref.table,ordering.field):'id';
      const cursorValue=c.document ? (field==='id'?c.document.id:c.document.data()[ordering!.field]) : c.values?.[0];
      if(cursorValue!==undefined)q=q.filter(field,ordering?.direction==='desc'?'lt':'gt',cursorValue instanceof Timestamp?cursorValue.toDate().toISOString():cursorValue);
      continue;
    }
    q=applyConstraint(q,ref.table,c);
  }
  for (const order of ref.order||[]) q=q.order(fieldFor(ref.table,order.field),{ascending:order.direction==='asc',nullsFirst:false});
  if (ref.take) q=q.limit(ref.take);
  const {data,error}=await q;
  if(error) throw error;
  return (data||[]) as any[];
}
export async function getDocs(ref: Ref): Promise<QuerySnap> { return querySnapshot(await getRows(ref),ref); }
export async function getDoc(ref: Ref): Promise<Snap> {
  const {data,error}=await supabase.from(ref.table).select(selectFor(ref.table)).eq(idFieldFor(ref.table),ref.id).maybeSingle();
  if(error) throw error;
  return snapshot(data,ref);
}
function serialize(ref: Ref, input: any) {
  const value=clean(input||{});
  const row: any={id:ref.id || value.id || value.uid || value.vendorId || value.transactionId || value.verificationRequestId || crypto.randomUUID(),payload:value};
  if(ref.table==='couponly_students'){row.id=value.uid||value.id||row.id;row.email=value.email||null;row.first_name=value.firstName||value.first_name||'';row.last_name=value.lastName||value.last_name||'';row.account_role=value.role||value.accountRole||'student';row.university_id=value.universityId||null;row.phone=value.phone||null;row.profile=value;delete row.payload;}
  if(ref.table==='couponly_vendors'){
    for (const field of ['newest', 'sortOrder']) {
      if (value[field] != null && (!Number.isSafeInteger(value[field]) || value[field] < 0)) {
        throw new Error('Vendor ordering must use non-negative whole numbers.');
      }
    }
    row.id=value.vendorId||value.id||row.id;row.user_id=value.userId||value.uid||null;row.name=value.name||value.businessName||'';row.status=value.status||'Pending';row.vendor_type='in_store';row.category_id=value.categoryId||null;row.catalogue_deal_id=value.catalogueDealId||null;
    row.website=value.website||null;row.logo_path=value.profilePicture??value.logoPath??null;row.description=value.shortDescription??value.description??null;row.locations=value.locations||[];row.settings=value.settings||{};
    row.place_label=value.place||value.placeLabel||null;row.image_url=value.imageUrl||value.profilePicture||null;row.cover_image_url=value.coverImage||null;row.color=value.color||null;row.rating=value.rating??null;row.distance_km=value.distanceKm??null;
    row.saving_label=value.savingLabel||null;row.offer_value=value.offerValue??null;row.trend=(value.isTrending ?? value.isFeatured ?? value.featured) ? Math.max(1, Number(value.trend) || 0) : 0;row.newest=value.newest??0;row.sort_order=value.sortOrder??0;row.featured=value.isTrending??value.isFeatured??value.featured??false;
    row.phone=value.phoneNumber||value.phone||null;row.gallery_images=value.galleryImages||[];row.tags=value.tagsEn||[];row.business_hours=value.businessHours||value.openingHours||{};
  }
  if(ref.table==='couponly_transactions'){row.id=value.id||value.transactionId||row.id;row.student_id=value.studentId||value.uid;row.vendor_id=value.vendorId||value.vendor_id||null;row.vendor_id_snapshot=value.vendorId||value.vendor_id_snapshot||'';row.offer_id=value.offerId||null;row.transaction_type=value.transactionType||'offer';row.status=value.status||'completed';row.idempotency_key=value.idempotencyKey||crypto.randomUUID();row.amount=value.amount||0;row.discount_amount=value.discountAmount||0;row.created_at=value.createdAt||new Date().toISOString();}
  if(ref.table==='couponly_verification_requests'){row.id=value.id||value.verificationRequestId||row.id;row.email=value.email;row.student_id=value.studentId||null;row.requested_role=value.role||'student';row.status=value.status||'pending';row.submitted_at=value.submittedAt||new Date().toISOString();row.id_image_path=value.idImagePath||null;row.rejection_reason=value.rejectionReason||null;row.details=value.details||value;delete row.payload;}
  if(ref.table==='couponly_universities'){row.name=value.name||'';row.email_domains=value.emailDomains||[];row.logo_path=value.logoPath||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='couponly_categories'){const categoryName=value.nameEnglish||value.name||'';row.name=categoryName;row.slug=value.slug||categoryName.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||null;row.image_path=value.imageUrl||value.imagePath||null;row.active=value.active??true;row.sort_order=value.order??value.sortOrder??0;}
  if(ref.table==='couponly_events'){row.title=value.title||'';row.starts_at=value.startsAt||null;row.ends_at=value.endsAt||null;row.image_path=value.imagePath||null;row.published=value.published??false;}
  if(ref.table==='couponly_banners'){row.title=value.title||null;row.image_path=value.imagePath||null;row.destination_url=value.destinationUrl||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='couponly_featured_brands'){row.vendor_id=value.vendorId||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='couponly_trending_offer_banners'){row.offer_id=value.offerId||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='couponly_notifications'){row.recipient_id=value.recipientId||value.userId||null;row.title=value.title||'Notification';row.body=value.body||'';row.data=value.data||{};row.sent_at=value.sentAt||new Date().toISOString();delete row.payload;}
  if(ref.table==='couponly_events'){row.title=value.title||'';row.starts_at=value.startsAt||null;row.ends_at=value.endsAt||null;row.image_path=value.imagePath||value.imageUrl||null;row.published=value.published??false;}
  if(ref.table==='couponly_map_cache'||ref.table==='couponly_opportunity_action_configs'){row.payload=value;}
  if(ref.parentStudentId){row.student_id=ref.parentStudentId;row.item_id=value.itemId||value.item_id||value.opportunityId||value.dealId||value.vendorId;row.item_type=value.itemType||value.type||'offer';}
  return row;
}
export async function setDoc(ref: Ref,value: any,options?: {merge?:boolean}) {
  const previous=options?.merge?(await getDoc(ref)).data():{};
  const payload=clean(options?.merge?{...previous,...value}:value);
  const row=serialize(ref,payload);
  if(payloadlessTables.has(ref.table))delete row.payload; else row.payload=payload;
  const {error}=await supabase.from(ref.table).upsert(row);
  if(error) throw error;
}
export async function updateDoc(ref: Ref,value: any) {
  const previous=(await getDoc(ref)).data();
  const merged=clean({...previous,...value});
  const row=serialize(ref,merged);
  if(!payloadlessTables.has(ref.table))row.payload=merged; else delete row.payload;
  const {error}=await supabase.from(ref.table).update(row).eq(idFieldFor(ref.table),ref.id);
  if(error) throw error;
}
export async function addDoc(ref: Ref,value: any) {
  const row=serialize(ref,value);
  const {data,error}=await supabase.from(ref.table).insert(row).select('id').single();
  if(error) throw error;
  return {...ref,kind:'document' as const,id:data.id};
}
export async function deleteDoc(ref: Ref) {
  const {error}=await supabase.from(ref.table).delete().eq(idFieldFor(ref.table),ref.id);
  if(error) throw error;
}
export async function getCountFromServer(ref: Ref) {
  let q:any=supabase.from(ref.table).select('*',{count:'exact',head:true});
  for(const c of ref.filters||[]) q=applyConstraint(q,ref.table,c);
  const {count,error}=await q;if(error)throw error;
  return {data:()=>({count:count||0})};
}
export const sum=(field:string)=>({operation:'sum',field});
export const count=()=>({operation:'count'});
export async function getAggregateFromServer(ref: Ref,aggregates: Record<string,any>) {
  const rows=await getRows(ref);const result:Record<string,number>={};
  for(const [key,aggregate] of Object.entries(aggregates)) result[key]=aggregate.operation==='count'?rows.length:rows.reduce((total,row)=>total+Number(normalize(row,ref)[aggregate.field]||0),0);
  return {data:()=>result};
}
export function onSnapshot(ref: Ref,callback: (snapshot: any)=>void,onError?: (error:Error)=>void) {
  let active=true, request=0;
  const refresh=async()=>{const current=++request;try{const snapshot=ref.kind==='document'?await getDoc(ref):await getDocs(ref);if(active&&current===request)callback(snapshot);}catch(error){if(active&&current===request)onError?.(error as Error);}};
  void refresh();
  const channel=supabase.channel('kouponly-' + ref.table + '-' + Math.random().toString(36).slice(2)).on('postgres_changes',{event:'*',schema:'public',table:ref.table},()=>void refresh()).subscribe();
  return ()=>{active=false;void supabase.removeChannel(channel);};
}

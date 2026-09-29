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
  students:'realx_students', vendors:'realx_vendors', transactions:'realx_transactions',
  categories:'realx_categories', universities:'realx_universities', events:'realx_events',
  banners:'realx_banners', featuredBrandShowcase:'realx_featured_brands',
  trendingOfferBanners:'realx_trending_offer_banners', notifications:'realx_notifications', cms:'realx_cms_documents',
  verification_requests:'realx_verification_requests', wakti_student_verification_requests:'realx_wakti_student_verification_requests',
  holdingGroups:'realx_holding_groups', holdingGroupUsers:'realx_holding_group_members',
  opportunities:'realx_opportunities', mapLocations:'realx_map_locations', maps:'realx_map_cache',
  opportunityActionConfigs:'realx_opportunity_action_configs', opportunityActionRequests:'realx_opportunity_action_requests',
  opportunityAnalytics:'realx_opportunity_analytics', onlineVendorAnalytics:'realx_online_vendor_analytics',
  onboarding_analytics:'realx_onboarding_analytics', rewardAccounts:'realx_reward_accounts',
  pilotCampaigns:'realx_pilot_campaigns', pilotCampaignIdentityClaims:'realx_pilot_campaign_identity_claims',
  inventoryBatches:'realx_inventory_batches', vendorOnlineRedemptionConfigs:'realx_vendor_online_configs',
  vendorRedemptionSecrets:'realx_vendor_redemption_secrets', vendor_pins:'realx_vendor_redemption_secrets', creator_codes:'realx_creator_codes',
  pushTokens:'realx_push_tokens', voucherCodes:'realx_badrgo_voucher_inventory',
  claims:'realx_badrgo_voucher_claims', eligibilityLocks:'realx_badrgo_voucher_claims',
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
    realx_students:{uid:'id',role:'account_role',accountRole:'account_role',firstName:'first_name',lastName:'last_name',universityId:'university_id',creatorCode:'creator_code'},
    realx_vendors:{vendorId:'id',userId:'user_id',categoryId:'category_id',vendorType:'vendor_type',logoPath:'logo_path'},
    realx_transactions:{transactionId:'id',studentId:'student_id',uid:'student_id',vendorId:'vendor_id',offerId:'offer_id',transactionType:'transaction_type',createdAt:'created_at'},
    realx_student_saved_items:{studentId:'student_id',itemId:'item_id',itemType:'item_type'},
    realx_verification_requests:{verificationRequestId:'id',studentId:'student_id',submittedAt:'submitted_at',reviewedAt:'reviewed_at',rejectionReason:'rejection_reason'},
    realx_wakti_student_verification_requests:{studentId:'student_id',universityId:'university_id',submittedAt:'submitted_at'},
    realx_map_locations:{vendorId:'vendor_id'},
    realx_holding_groups:{groupId:'id'}, realx_holding_group_members:{uid:'user_id',holdingGroupId:'holding_group_id'},
    realx_featured_brands:{vendorId:'vendor_id'}, realx_trending_offer_banners:{offerId:'offer_id'},
    realx_vendor_online_configs:{vendorId:'vendor_id'}, realx_online_vendor_clicks:{vendorId:'vendor_id',studentId:'student_id',clickedAt:'clicked_at'},
    realx_notifications:{recipientId:'recipient_id',sentAt:'sent_at'},
    realx_badrgo_voucher_inventory:{programId:'program_id',codeHash:'code_hash',codeValue:'code_value',importId:'import_id',batchId:'batch_id'},
    realx_badrgo_voucher_claims:{programId:'program_id',studentId:'student_id',weekKey:'week_key',voucherId:'voucher_id',identityHash:'identity_hash'},
    realx_opportunities:{categoryId:'category_id',startsAt:'starts_at',endsAt:'ends_at'},
    realx_opportunity_action_requests:{studentId:'student_id',opportunityId:'opportunity_id'},
  };
  return overrides[table]?.[field] || snake(field);
};
const idFieldFor = (table: string) => table === 'realx_vendor_online_configs' || table === 'realx_vendor_redemption_secrets' ? 'vendor_id' : 'id';
const payloadlessTables = new Set([
  'realx_online_vendor_clicks','realx_vendor_online_configs','realx_vendor_redemption_secrets',
  'realx_notifications','realx_verification_requests','realx_push_tokens','realx_creator_codes',
  'realx_pilot_campaign_identity_claims','realx_badrgo_voucher_inventory','realx_badrgo_voucher_claims',
]);
const asIso = (value: any) => value instanceof Timestamp ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : value;
function clean(value: any): any {
  if (value instanceof Timestamp || value instanceof Date) return asIso(value);
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clean(item)]));
  return value;
}
function collectionRef(tableName: string, parentStudentId?: string): Ref {
  const table = tableFor[tableName] || (tableName.startsWith('realx_') ? tableName : 'realx_' + snake(tableName));
  return {kind:'collection',table,filters:parentStudentId?[{kind:'where',field:'student_id',op:'==',value:parentStudentId}]:[],parentStudentId};
}
export function collection(_db: unknown, ...segments: string[]): Ref {
  if (segments.length >= 3 && segments[0] === 'students' && segments[2] === 'savedItems') return collectionRef('realx_student_saved_items',segments[1]);
  return collectionRef(segments.at(-1) || '');
}
export function doc(_db: unknown, ...segments: string[]): Ref {
  if (segments.length === 1 && segments[0].includes('/')) {
    const [collectionName, ...rest] = segments[0].split('/');
    return {...collectionRef(collectionName === 'meta' ? 'maps' : collectionName),kind:'document',id:rest.join('/')};
  }
  if (segments.length >= 4 && segments[0] === 'students' && segments[2] === 'savedItems') return {...collectionRef('realx_student_saved_items',segments[1]),kind:'document',id:segments[3]};
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
  const data: any = {...payload};
  for (const [key,value] of Object.entries(row)) {
    if (['payload','profile','settings'].includes(key)) continue;
    data[camel(key)] = value;
  }
  data.id = row.id;
  if (ref.table==='realx_students') { data.uid=row.id; data.firstName=data.firstName ?? ''; data.lastName=data.lastName ?? ''; data.role=data.role ?? data.accountRole; }
  if (ref.table==='realx_vendors') data.vendorId=row.id;
  if (ref.table==='realx_transactions') data.transactionId=row.id;
  if (ref.table==='realx_verification_requests') data.verificationRequestId=row.id;
  if (ref.table==='realx_vendor_online_configs') Object.assign(data,row.offer||{});
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
    if (['id','name','status','email','active','published','vendor_id','student_id','created_at','submitted_at','starts_at','ends_at','sent_at','sort_order','account_role','transaction_type','offer_id','category_id','university_id','item_type','item_id','role','holding_group_id','latitude','longitude'].includes(field)) {
      const value = c.value instanceof Timestamp ? c.value.toDate().toISOString() : c.value;
      return builder.filter(field,op,value as any);
    }
    return builder.filter('payload->>' + c.field,op,String(c.value));
  }
  return builder;
}
async function getRows(ref: Ref) {
  let q: any=supabase.from(ref.table).select('*');
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
  const {data,error}=await supabase.from(ref.table).select('*').eq(idFieldFor(ref.table),ref.id).maybeSingle();
  if(error) throw error;
  return snapshot(data,ref);
}
function serialize(ref: Ref, input: any) {
  const value=clean(input||{});
  const row: any={id:ref.id || value.id || value.uid || value.vendorId || value.transactionId || value.verificationRequestId || crypto.randomUUID(),payload:value};
  if(['realx_online_vendor_clicks'].includes(ref.table))delete row.payload;
  if(ref.table==='realx_students'){row.id=value.uid||value.id||row.id;row.email=value.email||null;row.first_name=value.firstName||value.first_name||'';row.last_name=value.lastName||value.last_name||'';row.account_role=value.role||value.accountRole||'student';row.university_id=value.universityId||null;row.phone=value.phone||null;row.profile=value;delete row.payload;}
  if(ref.table==='realx_vendors'){row.id=value.vendorId||value.id||row.id;row.user_id=value.userId||value.uid||null;row.name=value.name||value.businessName||'';row.status=value.status||'Pending';row.vendor_type=String(value.vendorType||'in_store').toLowerCase();row.category_id=value.categoryId||null;row.website=value.website||null;row.logo_path=value.logoPath||null;row.description=value.description||null;row.locations=value.locations||[];row.settings=value.settings||{};}
  if(ref.table==='realx_transactions'){row.id=value.id||value.transactionId||row.id;row.student_id=value.studentId||value.uid;row.vendor_id=value.vendorId||value.vendor_id||null;row.vendor_id_snapshot=value.vendorId||value.vendor_id_snapshot||'';row.offer_id=value.offerId||null;row.transaction_type=value.transactionType||'offer';row.status=value.status||'completed';row.idempotency_key=value.idempotencyKey||crypto.randomUUID();row.amount=value.amount||0;row.discount_amount=value.discountAmount||0;row.created_at=value.createdAt||new Date().toISOString();}
  if(ref.table==='realx_verification_requests'){row.id=value.id||value.verificationRequestId||row.id;row.email=value.email;row.student_id=value.studentId||null;row.requested_role=value.role||'student';row.status=value.status||'pending';row.submitted_at=value.submittedAt||new Date().toISOString();row.id_image_path=value.idImagePath||null;row.rejection_reason=value.rejectionReason||null;row.details=value.details||value;delete row.payload;}
  if(ref.table==='realx_universities'){row.name=value.name||'';row.email_domains=value.emailDomains||[];row.logo_path=value.logoPath||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='realx_categories'){row.name=value.name||'';row.slug=value.slug||null;row.image_path=value.imagePath||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='realx_events'){row.title=value.title||'';row.starts_at=value.startsAt||null;row.ends_at=value.endsAt||null;row.image_path=value.imagePath||null;row.published=value.published??false;}
  if(ref.table==='realx_banners'){row.title=value.title||null;row.image_path=value.imagePath||null;row.destination_url=value.destinationUrl||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='realx_featured_brands'){row.vendor_id=value.vendorId||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='realx_trending_offer_banners'){row.offer_id=value.offerId||null;row.active=value.active??true;row.sort_order=value.sortOrder||0;}
  if(ref.table==='realx_holding_groups'){row.name=value.name||'Holding group';row.status=value.status||'active';row.settings=value.settings||{};}
  if(ref.table==='realx_holding_group_members'){row.user_id=value.uid||value.userId;row.holding_group_id=value.holdingGroupId;row.role=value.role||'viewer';}
  if(ref.table==='realx_notifications'){row.recipient_id=value.recipientId||value.userId||null;row.title=value.title||'Notification';row.body=value.body||'';row.data=value.data||{};row.sent_at=value.sentAt||new Date().toISOString();delete row.payload;}
  if(ref.table==='realx_vendor_online_configs'){row.vendor_id=value.vendorId||ref.id;row.active=value.active??value.enabled??true;row.destination_url=value.destinationUrl||value.purchaseUrl||value.url||null;row.offer=value.offer||{discountCode:value.discountCode||'',purchaseUrl:value.purchaseUrl||'',iosUrl:value.iosUrl||null,androidUrl:value.androidUrl||null,fulfillmentMode:value.fulfillmentMode||null,ctaLabel:value.ctaLabel||null,ctaLabelAr:value.ctaLabelAr||null,instructions:value.instructions||null,instructionsAr:value.instructionsAr||null,dailyLimitPerUser:value.dailyLimitPerUser||1,enabled:value.enabled??false};row.daily_limit=value.dailyLimit||value.dailyLimitPerUser||null;delete row.id;}
  if(ref.table==='realx_events'){row.title=value.title||'';row.starts_at=value.startsAt||null;row.ends_at=value.endsAt||null;row.image_path=value.imagePath||value.imageUrl||null;row.published=value.published??false;}
  if(ref.table==='realx_map_cache'||ref.table==='realx_opportunity_action_configs'||ref.table==='realx_pilot_campaigns'){row.payload=value;}
  if(ref.table==='realx_vendor_redemption_secrets'){row.vendor_id=value.vendorId||ref.id;row.pin_hash=value.pinHash||'';row.pin_salt=value.pinSalt||'';row.rotated_by=value.rotatedBy||null;delete row.id;delete row.payload;}
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
  const refresh=async()=>{try{callback(ref.kind==='document'?await getDoc(ref):await getDocs(ref));}catch(error){onError?.(error as Error);}};
  void refresh();
  const channel=supabase.channel('realx-' + ref.table + '-' + Math.random().toString(36).slice(2)).on('postgres_changes',{event:'*',schema:'public',table:ref.table},()=>void refresh()).subscribe();
  return ()=>{void supabase.removeChannel(channel);};
}

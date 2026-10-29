import { createClient } from "npm:@supabase/supabase-js@2";
import { summarizeTickets, processNotificationReceipts } from "../_shared/push.ts";
import { validatePassword, validateUsername } from '../_shared/vendor-credentials.ts';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const snake = (value: string) => value.replace(/[A-Z]/g, (letter) => "_" + letter.toLowerCase());
const camelize = (value: Record<string, any>) => Object.fromEntries(Object.entries(value).map(([key,val]) => [key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase()),val]));
const randomPassword = () => crypto.randomUUID() + "aA1!";
const randomCreatorCode = () => [...crypto.getRandomValues(new Uint8Array(8))].map((value)=>value.toString(16).padStart(2,"0")).join("").slice(0,8).toUpperCase();
const geohashAlphabet="0123456789bcdefghjkmnpqrstuvwxyz";
const geohashForLocation=(latitude:number,longitude:number,precision=10)=>{
  let latMin=-90,latMax=90,lonMin=-180,lonMax=180,even=true,bit=0,value=0,result="";
  while(result.length<precision){
    if(even){const mid=(lonMin+lonMax)/2;if(longitude>=mid){value=(value<<1)|1;lonMin=mid;}else{value=value<<1;lonMax=mid;}}
    else{const mid=(latMin+latMax)/2;if(latitude>=mid){value=(value<<1)|1;latMin=mid;}else{value=value<<1;latMax=mid;}}
    even=!even;
    if(bit<4)bit++;else{result+=geohashAlphabet[value];bit=0;value=0;}
  }
  return result;
};
const isCoordinate=(value:unknown,min:number,max:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max;
const buildVendorMapData=(vendor:any)=>{
  const payload=vendor.payload||{};
  const raw=Array.isArray(vendor.locations)&&vendor.locations.length?vendor.locations:[{id:"primary",latitude:payload.latitude??payload.lat,longitude:payload.longitude??payload.lng,address:payload.address,isPrimary:true}];
  const locations=raw.flatMap((location:any,index:number)=>{
    const latitude=location?.latitude,longitude=location?.longitude;
    if(!isCoordinate(latitude,-90,90)||!isCoordinate(longitude,-180,180))return [];
    const fullHash=geohashForLocation(latitude,longitude);
    return [{id:typeof location.id==="string"&&location.id?location.id:location.isPrimary===true?"primary":`branch-${index+1}`,name:typeof location.name==="string"?location.name:null,phoneNumber:typeof location.phoneNumber==="string"?location.phoneNumber:null,latitude,longitude,geohash:fullHash,address:typeof location.address==="string"?location.address:payload.address||null,isPrimary:location.isPrimary===true||index===0}];
  });
  if(vendor.status&&String(vendor.status).toLowerCase()!=="active")return {entry:null,rows:[]};
  const offers=Array.isArray(payload.offers)?payload.offers:[];
  const offerTypes=[...new Set(offers.map((offer:any)=>offer?.discountType).filter((value:any)=>typeof value==="string"))];
  const primary=locations.find((location:any)=>location.isPrimary)||locations[0];
  if(!primary)return {entry:null,rows:[]};
  const locationsForCache=locations.map((location:any)=>({...location}));
  const entry={name:vendor.name||payload.name||null,vendorName:vendor.name||payload.name||null,latitude:primary.latitude,longitude:primary.longitude,geohash:primary.geohash.slice(0,5),address:payload.address||primary.address||null,mainCategory:payload.mainCategory||null,profilePicture:payload.profilePicture||payload.logo||payload.logoUrl||null,xcard:payload.xcard===true,offerTypes,hasBuyOneGetOne:offerTypes.includes("buy1get1"),hasStudentDeal:offers.length>0,openingHours:payload.openingHours||payload.hours||null,searchTokens:Array.isArray(payload.searchTokens)?payload.searchTokens:[],firstOffer:offers.length?{titleEn:offers[0]?.titleEn||undefined,discountType:offers[0]?.discountType||undefined}:null,locations:locationsForCache};
  const rows=locations.map((location:any)=>{
    const hash=location.geohash;
    const locationId=String(location.id).replace(/[\/\s]+/g,"_");
    const rowPayload={name:entry.name,vendorName:entry.vendorName,branchName:location.name,phoneNumber:location.phoneNumber,geohash:hash,geohash4:hash.slice(0,4),geohash5:hash.slice(0,5),geohash6:hash.slice(0,6),address:location.address,mainCategory:entry.mainCategory,profilePicture:entry.profilePicture,vendorType:vendor.vendor_type||null,status:vendor.status||null,isActive:!vendor.status||String(vendor.status).toLowerCase()==="active",xcard:entry.xcard,offerTypes,hasBuyOneGetOne:entry.hasBuyOneGetOne,hasStudentDeal:entry.hasStudentDeal,openingHours:entry.openingHours,searchTokens:entry.searchTokens,firstOffer:entry.firstOffer,isPrimary:location.isPrimary,updatedAt:new Date().toISOString()};
    return {id:`${vendor.id}_${locationId}`,vendor_id:vendor.id,latitude:location.latitude,longitude:location.longitude,geohash:hash,payload:rowPayload,updated_at:new Date().toISOString()};
  });
  return {entry,rows};
};
const refreshVendorMap = async(service:any,vendorId:string)=>{
  const {data:vendor,error:vendorError}=await service.from("couponly_vendors").select("id,name,status,vendor_type,locations,payload").eq("id",vendorId).maybeSingle();
  if(vendorError)throw vendorError;
  const {entry,rows}=vendor?buildVendorMapData(vendor):{entry:null,rows:[]};
  const {error:deleteError}=await service.from("couponly_map_locations").delete().eq("vendor_id",vendorId);
  if(deleteError)throw deleteError;
  for(let offset=0;offset<rows.length;offset+=500){const {error}=await service.from("couponly_map_locations").upsert(rows.slice(offset,offset+500));if(error)throw error;}
  const {error:saveError}=await service.rpc("couponly_update_map_cache_entry",{p_vendor_id:vendorId,p_entry:entry});
  if(saveError)throw saveError;
  return {vendorId,locationCount:rows.length,indexed:Boolean(entry)};
};
const encodeCursor=(value:unknown)=>{const bytes=new TextEncoder().encode(JSON.stringify(value));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");};
const decodeCursor=(value:string)=>{const normalized=value.replaceAll("-","+").replaceAll("_","/");const binary=atob(normalized+"=".repeat((4-normalized.length%4)%4));const bytes=Uint8Array.from(binary,(char)=>char.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));};
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
const adminRole = async (client: any, uid: string) => {
  const {data,error}=await client.from("couponly_user_roles").select("role").eq("user_id",uid).maybeSingle();
  if(error)throw error;
  return data;
};
const getExistingAuthUser = async (service: any, email: string) => {
  for (let page=1;page<=10;page++) {
    const {data,error}=await service.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const found=data.users.find((item:any)=>item.email?.toLowerCase()===email.toLowerCase());
    if(found)return found;
    if(data.users.length<1000)break;
  }
  return null;
};
const vendorUsernameAuthEmail = async (username: string) => {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(username));
  const localPart=Array.from(new Uint8Array(digest),(byte)=>byte.toString(16).padStart(2,"0")).join("");
  return `${localPart}@vendor.kouponly.invalid`;
};
const createAuthUser = async (service: any,input: any) => {
  const {data,error}=await service.auth.admin.createUser({
    email:String(input.email||"").trim().toLowerCase(),
    password:input.password||randomPassword(),email_confirm:true,
    user_metadata:{full_name:input.displayName||[input.firstName,input.lastName].filter(Boolean).join(" ")||input.name||"",...(typeof input.username==="string"?{username:input.username}:{})},
  });
  if(error)throw error;
  return data.user;
};
const insertAudit = async (service:any,actor:string,action:string,type:string,id:string|null,details:any={}) => {
  await service.from("couponly_admin_audit_log").insert({actor_id:actor,action,entity_type:type,entity_id:id,details});
};
const assignCreatorCode = async (service:any,studentId:string) => {
  const {data:student,error:studentError}=await service.from("couponly_students").select("creator_code").eq("id",studentId).maybeSingle();
  if(studentError)throw studentError;
  if(student?.creator_code)return student.creator_code;
  for(let attempt=0;attempt<8;attempt++){
    const code=randomCreatorCode();
    const {error}=await service.from("couponly_creator_codes").insert({code,student_id:studentId});
    if(!error){
      const {error:updateError}=await service.from("couponly_students").update({creator_code:code}).eq("id",studentId);
      if(updateError)throw updateError;
      return code;
    }
    if(error.code!=="23505")throw error;
  }
  throw new Error("A creator code could not be assigned. Please retry.");
};

Deno.serve(async (request) => {
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="POST")return response({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL");
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anonKey||!serviceKey)return response({error:"Supabase server configuration is incomplete"},500);
  const authorization=request.headers.get("Authorization")||"";
  const token=authorization.replace(/^Bearer\s+/i,"");
  if(!token)return response({error:"Authentication required"},401);
  const caller=createClient(url,anonKey,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const {data:{user},error:userError}=await caller.auth.getUser(token);
  if(userError||!user)return response({error:"Authentication required"},401);
  const role=await adminRole(caller,user.id).catch(()=>null);
  const isAdmin=role?.role==="admin";
  const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const body=await request.json();
    const action=String(body.action||"");
    const data=body.data||{};
    if(!action)return response({error:"Action is required"},400);
    const requireAdmin=()=>{if(!isAdmin)fail("Admin access required",403);};


    switch(action){
      case "syncVendorMapLocation": {
        requireAdmin();const vendorId=String(data.vendorId||"");if(!vendorId)fail("vendorId is required");
        return response({success:true,...await refreshVendorMap(service,vendorId)});
      }
      case "rebuildLocationsCache":
      case "rebuildMapLocationIndex": {
        requireAdmin();
        const vendors:any[]=[];for(let offset=0;;offset+=1000){const {data:page,error}=await service.from("couponly_vendors").select("id,name,status,vendor_type,locations,payload").order("id").range(offset,offset+999);if(error)throw error;vendors.push(...(page||[]));if(!page||page.length<1000)break;}
        const fullCache=action==="rebuildLocationsCache"?{}:null;
        if(fullCache){const {error}=await service.from("couponly_map_locations").delete().neq("id","");if(error)throw error;}
        else {const {error}=await service.from("couponly_map_locations").delete().neq("id","");if(error)throw error;}
        const cache:any={};const rows:any[]=[];let vendorCount=0;
        for(const vendor of vendors){const result=buildVendorMapData(vendor);if(result.entry){cache[vendor.id]=result.entry;vendorCount++;}rows.push(...result.rows);}
        for(let offset=0;offset<rows.length;offset+=500){const {error}=await service.from("couponly_map_locations").upsert(rows.slice(offset,offset+500));if(error)throw error;}
        if(action==="rebuildLocationsCache") {const {error}=await service.from("couponly_map_cache").upsert({id:"locations",payload:cache,updated_at:new Date().toISOString()});if(error)throw error;}
        return response({success:true,vendorsScanned:vendors.length,vendorCount,locationCount:rows.length});
      }
      case "backfillVendorGeohashes": {
        requireAdmin();const limit=Math.max(1,Math.min(1000,Number(data.limit||500)));
        const {data:vendors,error}=await service.from("couponly_vendors").select("id,payload").order("id").limit(limit);if(error)throw error;
        let updated=0;
        for(const vendor of vendors||[]){const lat=vendor.payload?.latitude??vendor.payload?.lat,lng=vendor.payload?.longitude??vendor.payload?.lng;if(!isCoordinate(lat,-90,90)||!isCoordinate(lng,-180,180))continue;const geohash=geohashForLocation(lat,lng).slice(0,5);if(vendor.payload?.geohash===geohash)continue;const {error:updateError}=await service.from("couponly_vendors").update({payload:{...(vendor.payload||{}),geohash}}).eq("id",vendor.id);if(updateError)throw updateError;updated++;}
        return response({scanned:vendors?.length||0,updated,limit});
      }
      case "createStudentUser": {
        requireAdmin();
        const email=String(data.email||"").trim().toLowerCase();
        if(!email||!/^\S+@\S+\.\S+$/.test(email))fail("A valid email is required");
        if(data.role!==undefined&&!['student','creator'].includes(data.role))fail("Role must be student or creator");
        const created=await createAuthUser(service,data);
        const payload={uid:created.id,email:created.email,firstName:data.firstName||"",lastName:data.lastName||"",role:data.role||"student",gender:data.gender||null,dob:data.dob||null};
        const {error}=await service.from("couponly_students").upsert({
          id:created.id,email:created.email,first_name:payload.firstName,last_name:payload.lastName,
          account_role:payload.role,profile:payload,payload,verification_status:"verified",
        });
        if(error)throw error;
        if(payload.role==="creator"){
          const creatorCode=await assignCreatorCode(service,created.id);
          await insertAudit(service,user.id,action,"student",created.id,{email:created.email,creatorCode});
          return response({uid:created.id,success:true,creatorCode});
        }
        await insertAudit(service,user.id,action,"student",created.id,{email:created.email});
        return response({uid:created.id,success:true});
      }
      case "deleteStudentUser":
      case "deleteVendorUser": {
        requireAdmin();
        const uid=String(data.uid||data.userId||"");
        if(!uid)fail("User ID is required");
        if(action==="deleteStudentUser"){
          const {error:transactionError}=await service.from("couponly_transactions").delete().eq("student_id",uid);
          if(transactionError)throw transactionError;
          const {error:authError}=await service.auth.admin.deleteUser(uid);
          if(authError&&authError.status!==404)throw authError;
        }else{
          const {error:vendorError}=await service.from("couponly_vendors").delete().eq("id",uid);
          if(vendorError)throw vendorError;
          const {error:authError}=await service.auth.admin.deleteUser(uid);
          if(authError&&authError.status!==404)throw authError;
          try{
            const {data:objects}=await service.storage.from("kouponly-public-media").list(`vendors/${uid}/gallery`,{limit:1000});
            const files=(objects||[]).filter((item:any)=>item.id).map((item:any)=>`vendors/${uid}/gallery/${item.name}`);
            if(files.length)await service.storage.from("kouponly-public-media").remove(files);
          }catch(storageError){console.warn("Vendor gallery cleanup failed",String((storageError as any)?.message||storageError));}
        }
        await insertAudit(service,user.id,action,action==="deleteStudentUser"?"student":"vendor",uid);
        return response({success:true});
      }
      case "createVendorUser": {
        requireAdmin();
        const username=validateUsername(data.username);
        validatePassword(data.password);
        const categoryIds=Array.isArray(data.categoryIds)?[...new Set(data.categoryIds.map((id:unknown)=>String(id).trim()).filter(Boolean))]:[];
        const categoryId=String(data.categoryId||categoryIds[0]||"").trim();
        if(!categoryIds.length&&categoryId)categoryIds.push(categoryId);
        if(!categoryIds.length||categoryIds[0]!==categoryId)fail("Select one or more active main categories; the first is primary");
        const {data:categories,error:categoryError}=await service.from("couponly_categories").select("id").in("id",categoryIds).eq("active",true);
        if(categoryError)throw categoryError;
        if((categories||[]).length!==categoryIds.length)fail("Every selected category must be active");
        const name=String(data.name||"").trim();
        const created=await createAuthUser(service,{...data,email:await vendorUsernameAuthEmail(username),username,name});
        const vendor={id:created.id,user_id:created.id,name,category_id:categoryId,status:"Active",vendor_type:"in_store",payload:{name,username,contact:username,vendorType:"in_store",categoryIds,offers:[],locations:[]}};
        try{
          const {error:vendorError}=await service.from("couponly_vendors").insert(vendor);
          if(vendorError)throw vendorError;
          const {error:membershipError}=await service.from("couponly_vendor_memberships").insert({user_id:created.id,vendor_id:created.id,role:"owner"});
          if(membershipError)throw membershipError;
          const {error:roleError}=await service.from("couponly_user_roles").insert({user_id:created.id,role:"vendor",vendor_id:created.id});
          if(roleError)throw roleError;
          await insertAudit(service,user.id,action,"vendor",created.id,{username});
          return response({uid:created.id,success:true});
        }catch(error){
          await service.from("couponly_vendors").delete().eq("id",created.id);
          await service.from("couponly_vendor_memberships").delete().eq("vendor_id",created.id);
          await service.from("couponly_user_roles").delete().eq("user_id",created.id);
          await service.auth.admin.deleteUser(created.id);
          throw error;
        }
      }
      case "approveVerificationRequest":
      case "rejectVerificationRequest": {
        requireAdmin();
        const id=String(data.verificationRequestId||"");
        if(!id)fail("verificationRequestId is required");
        const decision=action==="approveVerificationRequest"?"approved":"rejected";
        const {data:request,error:requestError}=await service.from("couponly_verification_requests").select("email,requested_role,status,student_id").eq("id",id).maybeSingle();
        if(requestError)throw requestError;if(!request)fail("Verification request not found",404);
        let review:any;
        if(request.status==="pending"){
          const result=await caller.rpc("couponly_review_verification_request",{p_request_id:id,p_decision:decision,p_reason:data.rejectionReason||null});
          if(result.error)throw result.error;review=result.data;
        }else if(request.status===decision){
          review={email:request.email,studentId:request.student_id,role:request.requested_role,requestId:id};
        }else fail("Verification request has already been reviewed",409);
        let uid=review?.studentId||null;
        let creatorCode:string|null=null;
        if(decision==="approved"){
          const existing=await getExistingAuthUser(service,String(review.email||""));
          const target=existing||await createAuthUser(service,{email:review.email,password:randomPassword()});
          uid=target.id;
          const accountRole=data.role==="creator"||review.role==="creator"?"creator":"student";
          const profile={email:review.email,firstName:data.firstName||"",lastName:data.lastName||"",gender:data.gender||null,dob:data.dob||null,role:accountRole};
          const {error:studentError}=await service.from("couponly_students").upsert({id:uid,email:review.email,first_name:profile.firstName,last_name:profile.lastName,account_role:accountRole,verification_status:"verified",profile,payload:profile});
          if(studentError)throw studentError;
          if(accountRole==="creator")creatorCode=await assignCreatorCode(service,uid);
          await service.from("couponly_verification_requests").update({student_id:uid}).eq("id",id);
        } else {
          const {data:req}=await service.from("couponly_verification_requests").select("id_image_path").eq("id",id).maybeSingle();
          if(req?.id_image_path)await service.storage.from("kouponly-student-documents").remove([String(req.id_image_path).replace(/^(?:couponly|kouponly)-student-documents\//,"")]);
          await service.from("couponly_verification_requests").update({id_image_path:null}).eq("id",id);
        }
        await insertAudit(service,user.id,action,"verification_request",id,{uid,decision});
        const resendKey=Deno.env.get("RESEND_API_KEY");
        if(resendKey&&review.email){
          const approved=decision==="approved";
          const message=approved?"Your student status is verified. Sign in to continue setting up your account.":(data.rejectionReason?"We could not verify your student status: "+String(data.rejectionReason).slice(0,300):"We could not verify your student status. Try again with a clearer document.");
          const from=Deno.env.get("RESEND_FROM_EMAIL")||"Kouponly <verification@kouponly.com>";
          await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[review.email],subject:approved?"Your student verification is approved":"Your student verification needs an update",text:message})}).catch(()=>undefined);
        }
        return response({success:true,uid,creatorCode});
      }
      case "listPendingVerificationRequests": {
        requireAdmin();
        const pageSize=Math.min(50,Math.max(1,Number(data.limit||25)));
        let q=service.from("couponly_verification_requests").select("id,email,submitted_at,id_image_path").eq("status","pending").order("submitted_at",{ascending:true}).limit(pageSize);
        const cursorMillis=Number(data.cursorMillis||0);
        if(Number.isFinite(cursorMillis)&&cursorMillis>0)q=q.gt("submitted_at",new Date(cursorMillis).toISOString());
        const {data:rows,error}=await q;if(error)throw error;
        const bucket=service.storage.from("kouponly-student-documents");
        const requests=await Promise.all((rows||[]).map(async(row:any)=>{
          const path=String(row.id_image_path||"").replace(/^(?:couponly|kouponly)-student-documents\//,"");
          const signed=path?await bucket.createSignedUrl(path,3600):{data:null};
          return {requestId:row.id,email:row.email,submittedAt:row.submitted_at,idImageUrl:signed.data?.signedUrl||null};
        }));
        const last=rows?.at(-1)?.submitted_at;
        return response({requests,nextCursorMillis:rows?.length===pageSize&&last?new Date(last).getTime():null});
      }
      case "deleteVerificationRequest": {
        requireAdmin();
        const id=String(data.verificationRequestId||"");
        const {data:req,error}=await service.from("couponly_verification_requests").select("id_image_path").eq("id",id).maybeSingle();
        if(error)throw error;if(!req)fail("Verification request not found",404);
        if(req.id_image_path)await service.storage.from("kouponly-student-documents").remove([String(req.id_image_path).replace(/^(?:couponly|kouponly)-student-documents\//,"")]);
        const {error:deleteError}=await service.from("couponly_verification_requests").delete().eq("id",id);
        if(deleteError)throw deleteError;
        await insertAudit(service,user.id,action,"verification_request",id);
        return response({success:true});
      }
      case "sendNotification": {
        requireAdmin();
        const title=String(data.title||"").trim(), message=String(data.body||"").trim();
        const topic=String(data.topic||"all-users"),imageUrl=String(data.imageUrl||"").trim();
        const vendorId=String(data.vendorId||"").trim();
        if(!title||!message||title.length>100||message.length>500)fail("Title and body are required and must be within length limits");
        if(topic!=="all-users")fail("Only the all-users audience is currently supported");
        if(vendorId){const {data:vendor,error:vendorError}=await service.from("couponly_vendors").select("id,status").eq("id",vendorId).maybeSingle();if(vendorError)throw vendorError;if(!vendor||vendor.status!=="Active")fail("Choose an active vendor for this notification",400);}
        if(imageUrl){try{if(new URL(imageUrl).protocol!=="https:")throw new Error("HTTPS required");}catch{fail("Image URL must be a valid HTTPS URL");}}
        const dateKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Qatar",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
        const entries:any[]=[];
        for(let offset=0;;offset+=1000){const {data:page,error:tokenError}=await service.from("couponly_push_tokens").select("id,user_id,token").order("id").range(offset,offset+999);if(tokenError)throw tokenError;entries.push(...(page||[]));if(!page||page.length<1000)break;}
        if(entries.length===0)fail("No registered push devices. Open Kouponly on a device and allow notifications before sending a campaign.",409);
        const {data:quota,error:quotaError}=await service.rpc("couponly_consume_notification_quota",{p_date_key:dateKey,p_daily_limit:2});
        if(quotaError)throw quotaError;
        if(!quota)fail("Daily notification limit reached (2 per Qatar day).",429);
        const destination=vendorId?{vendorId,path:`/kouponly/vendor/${encodeURIComponent(vendorId)}`}:{path:"/notifications"};
        const {data:record,error}=await service.from("couponly_notifications").insert({title,body:message,data:{imageUrl:imageUrl||null,topic,...destination},status:"queued",sent_by:user.id,date_key:dateKey}).select("id").single();
        if(error)throw error;
        let sentCount=0,failedCount=0,invalidTokenCount=0;
        const successfulUsers=new Set<string>();
        const errors:string[]=[];
        for(let offset=0;offset<entries.length;offset+=100){
          const chunk=entries.slice(offset,offset+100);
          let payload:any;
          try {
            const push=await fetch("https://exp.host/--/api/v2/push/send",{
              method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},
              signal:AbortSignal.timeout(15000),
              body:JSON.stringify(chunk.map((item:any)=>({to:item.token,title,body:message,priority:"high",channelId:"kouponly_general_v2",...(imageUrl?{richContent:{image:imageUrl}}:{}),data:{type:"admin_broadcast",campaignId:record.id,imageUrl:imageUrl||null,...destination}})))
            });
            payload=await push.json();
            if(!push.ok)payload={errors:payload.errors||[{message:`Expo rejected the request (${push.status})`}]};
          } catch(error) {
            payload={errors:[{message:String((error as any)?.message||error)}]};
          }
          const receipts:any[]=[],invalidTokens:string[]=[];
          for(const result of summarizeTickets(chunk,payload)){
            if(result.accepted){
              sentCount++;successfulUsers.add(result.entry.user_id);
              receipts.push({campaign_id:record.id,token_id:result.entry.id,receipt_id:result.receiptId,status:"pending"});
            } else {
              failedCount++;errors.push(result.error);
              if(result.invalid){invalidTokenCount++;invalidTokens.push(result.entry.token);}
            }
          }
          if(receipts.length){const {error}=await service.from("couponly_notification_deliveries").insert(receipts);if(error)throw error;}
          if(invalidTokens.length){const {error}=await service.from("couponly_push_tokens").delete().in("token",invalidTokens);if(error)throw error;}
        }
        const historyRows=[...successfulUsers].map(user_id=>({user_id,kind:"admin_broadcast",title,body:message,data:{campaignId:record.id,imageUrl:imageUrl||null,...destination}}));
        for(let offset=0;offset<historyRows.length;offset+=500){const {error}=await service.from("notifications").insert(historyRows.slice(offset,offset+500));if(error)throw error;}
        const deliveryStatus=sentCount?"processing":"failed";
        const deliveryErrors=[...new Set(errors)].slice(0,10);
        const {error:updateError}=await service.from("couponly_notifications").update({status:deliveryStatus,sent_count:sentCount,failed_count:failedCount,invalid_token_count:invalidTokenCount,total_registered:entries.length,data:{imageUrl:imageUrl||null,topic,...destination,errors:deliveryErrors},completed_at:sentCount?null:new Date().toISOString()}).eq("id",record.id);
        if(updateError)throw updateError;
        await insertAudit(service,user.id,action,"notification",record.id,{recipientCount:entries.length,sentCount,failedCount,invalidTokenCount});
        return response({success:sentCount>0,campaignId:record.id,status:deliveryStatus,sentCount,failedCount,totalRegistered:entries.length,errors:deliveryErrors});
      }
      case "notificationStatus": {
        requireAdmin();
        await processNotificationReceipts(service);
        const {data:campaigns,error}=await service.from("couponly_notifications").select("*").order("sent_at",{ascending:false}).limit(10);
        if(error)throw error;
        const {count,error:countError}=await service.from("couponly_push_tokens").select("id",{count:"exact",head:true});
        if(countError)throw countError;
        return response({campaigns,registeredDevices:count||0});
      }

      case "deleteTransaction": {
        requireAdmin();
        const id=String(data.transactionId||"");if(!id)fail("transactionId is required");
        const {error}=await service.from("couponly_transactions").delete().eq("id",id);if(error)throw error;
        await insertAudit(service,user.id,action,"transaction",id);return response({success:true});
      }
      case "listAdminTransactions": {
        requireAdmin();
        const size=Math.min(100,Math.max(1,Number(data.pageSize||10)));
        const sorts:Record<string,{field:string;ascending:boolean}>={date_asc:{field:"created_at",ascending:true},date_desc:{field:"created_at",ascending:false},amount_asc:{field:"total_amount",ascending:true},amount_desc:{field:"total_amount",ascending:false},vendor_asc:{field:"vendor_name",ascending:true},vendor_desc:{field:"vendor_name",ascending:false}};
        const sort=sorts[String(data.sort||"date_desc")];if(!sort)fail("Unsupported transaction sort");
        let q=service.from("couponly_transactions").select("*",{count:"exact"}).neq("transaction_type","online").order(sort.field,{ascending:sort.ascending,nullsFirst:false}).order("id",{ascending:sort.ascending}).limit(size+1);
        if(data.vendorName)q=q.eq("vendor_name",String(data.vendorName).slice(0,200));
        if(data.cursor){
          const cursor=decodeCursor(String(data.cursor));
          if(!cursor||!(typeof cursor.value==="string"||typeof cursor.value==="number")||typeof cursor.id!=="string")fail("Invalid transaction cursor");
          const operator=sort.ascending?"gt":"lt";
          const val=typeof cursor.value==="number"?String(cursor.value):'"'+cursor.value.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
          const id=String(cursor.id).replace(/[^a-f0-9-]/gi,"");
          q=q.or(`${sort.field}.${operator}.${val},and(${sort.field}.eq.${val},id.${operator}.${id})`);
        }
        const {data:rows,error,count}=await q;if(error)throw error;
        const all=rows||[],hasNext=all.length>size,page=all.slice(0,size);
        const transactions=page.map((row:any)=>({id:row.id,transactionId:row.id,rawDate:row.created_at,createdAt:row.created_at,user_id:row.student_id,vendor_id:row.vendor_id,vendorName:row.vendor_name||"Unknown Vendor",vendorId:row.vendor_id,totalAmount:row.total_amount||row.amount,totalAmountNum:Number(row.total_amount||row.amount||0),finalAmount:row.final_amount,discountAmount:row.discount_amount,type:row.transaction_type,status:row.status,cashbackAmount:row.cashback_amount,creatorCashbackAmount:row.creator_cashback_amount,creatorCode:row.creator_code,creatorUid:row.creator_uid,offerId:row.offer_id,redemptionCardAmount:row.redemption_card_amount,remainingAmount:row.remaining_amount,cursor_value:row[sort.field]}));
        const last=page.at(-1);
        return response({transactions,nextCursor:hasNext&&last?encodeCursor({value:last[sort.field]??(sort.ascending?"":""),id:last.id}):null,totalCount:count||0});
      }
      default:
        fail("Unknown admin action: "+action,404);
    }
  } catch(error) {
    const status=Number((error as any)?.status||500);
    console.error("couponly-admin-action",String((error as any)?.message||error));
    return response({error:(error as any)?.message||"Admin action failed"},status);
  }
});

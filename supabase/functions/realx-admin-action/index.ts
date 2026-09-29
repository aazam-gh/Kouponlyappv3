import { createClient } from "npm:@supabase/supabase-js@2";

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
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part)=>part.toString(16).padStart(2,"0")).join("");
};
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
  const raw=Array.isArray(vendor.locations)&&vendor.locations.length?vendor.locations:[{id:"primary",latitude:payload.latitude??payload.lat,longitude:payload.longitude??payload.lng,address:payload.address,addressAr:payload.addressAr,isPrimary:true}];
  const locations=raw.flatMap((location:any,index:number)=>{
    const latitude=location?.latitude,longitude=location?.longitude;
    if(!isCoordinate(latitude,-90,90)||!isCoordinate(longitude,-180,180))return [];
    const fullHash=geohashForLocation(latitude,longitude);
    return [{id:typeof location.id==="string"&&location.id?location.id:location.isPrimary===true?"primary":`branch-${index+1}`,name:typeof location.name==="string"?location.name:null,nameAr:typeof location.nameAr==="string"?location.nameAr:null,phoneNumber:typeof location.phoneNumber==="string"?location.phoneNumber:null,latitude,longitude,geohash:fullHash,address:typeof location.address==="string"?location.address:payload.address||null,addressAr:typeof location.addressAr==="string"?location.addressAr:payload.addressAr||null,isPrimary:location.isPrimary===true||index===0}];
  });
  if(vendor.status&&String(vendor.status).toLowerCase()!=="active"||vendor.vendor_type==="online"||payload.vendorType==="online")return {entry:null,rows:[]};
  const offers=Array.isArray(payload.offers)?payload.offers:[];
  const offerTypes=[...new Set(offers.map((offer:any)=>offer?.discountType).filter((value:any)=>typeof value==="string"))];
  const primary=locations.find((location:any)=>location.isPrimary)||locations[0];
  if(!primary)return {entry:null,rows:[]};
  const locationsForCache=locations.map((location:any)=>({...location}));
  const entry={name:vendor.name||payload.name||null,nameAr:payload.nameAr||null,vendorName:vendor.name||payload.name||null,vendorNameAr:payload.nameAr||null,latitude:primary.latitude,longitude:primary.longitude,geohash:primary.geohash.slice(0,5),address:payload.address||primary.address||null,addressAr:payload.addressAr||primary.addressAr||null,mainCategory:payload.mainCategory||null,profilePicture:payload.profilePicture||payload.logo||payload.logoUrl||null,xcard:payload.xcard===true,offerTypes,hasBuyOneGetOne:offerTypes.includes("buy1get1"),hasStudentDeal:offers.length>0,openingHours:payload.openingHours||payload.hours||null,searchTokens:Array.isArray(payload.searchTokens)?payload.searchTokens:[],firstOffer:offers.length?{titleEn:offers[0]?.titleEn||undefined,titleAr:offers[0]?.titleAr||undefined,discountType:offers[0]?.discountType||undefined}:null,locations:locationsForCache};
  const rows=locations.map((location:any)=>{
    const hash=location.geohash;
    const locationId=String(location.id).replace(/[\/\s]+/g,"_");
    const rowPayload={name:entry.name,nameAr:entry.nameAr,vendorName:entry.vendorName,vendorNameAr:entry.vendorNameAr,branchName:location.name,branchNameAr:location.nameAr,phoneNumber:location.phoneNumber,geohash:hash,geohash4:hash.slice(0,4),geohash5:hash.slice(0,5),geohash6:hash.slice(0,6),address:location.address,addressAr:location.addressAr,mainCategory:entry.mainCategory,profilePicture:entry.profilePicture,vendorType:vendor.vendor_type||null,status:vendor.status||null,isActive:!vendor.status||String(vendor.status).toLowerCase()==="active",xcard:entry.xcard,offerTypes,hasBuyOneGetOne:entry.hasBuyOneGetOne,hasStudentDeal:entry.hasStudentDeal,openingHours:entry.openingHours,searchTokens:entry.searchTokens,firstOffer:entry.firstOffer,isPrimary:location.isPrimary,updatedAt:new Date().toISOString()};
    return {id:`${vendor.id}_${locationId}`,vendor_id:vendor.id,latitude:location.latitude,longitude:location.longitude,geohash:hash,payload:rowPayload,updated_at:new Date().toISOString()};
  });
  return {entry,rows};
};
const refreshVendorMap = async(service:any,vendorId:string)=>{
  const {data:vendor,error:vendorError}=await service.from("realx_vendors").select("id,name,status,vendor_type,locations,payload").eq("id",vendorId).maybeSingle();
  if(vendorError)throw vendorError;
  const {entry,rows}=vendor?buildVendorMapData(vendor):{entry:null,rows:[]};
  const {error:deleteError}=await service.from("realx_map_locations").delete().eq("vendor_id",vendorId);
  if(deleteError)throw deleteError;
  for(let offset=0;offset<rows.length;offset+=500){const {error}=await service.from("realx_map_locations").upsert(rows.slice(offset,offset+500));if(error)throw error;}
  const {error:saveError}=await service.rpc("realx_update_map_cache_entry",{p_vendor_id:vendorId,p_entry:entry});
  if(saveError)throw saveError;
  return {vendorId,locationCount:rows.length,indexed:Boolean(entry)};
};
const encodeCursor=(value:unknown)=>{const bytes=new TextEncoder().encode(JSON.stringify(value));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");};
const decodeCursor=(value:string)=>{const normalized=value.replaceAll("-","+").replaceAll("_","/");const binary=atob(normalized+"=".repeat((4-normalized.length%4)%4));const bytes=Uint8Array.from(binary,(char)=>char.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));};
const fail = (message: string, status = 400) => { throw Object.assign(new Error(message), { status }); };
const adminRole = async (client: any, uid: string) => {
  const {data,error}=await client.from("realx_user_roles").select("role,holding_group_id").eq("user_id",uid).maybeSingle();
  if(error)throw error;
  return data;
};
const getHoldingScope=async(service:any,uid:string,role:any)=>{
  const groupId=String(role?.holding_group_id||"");if(!groupId)fail("Holding account access required",403);
  const [{data:member,error:memberError},{data:group,error:groupError},{data:links,error:linkError}]=await Promise.all([
    service.from("realx_holding_group_members").select("role,disabled_at,payload").eq("user_id",uid).eq("holding_group_id",groupId).maybeSingle(),
    service.from("realx_holding_groups").select("id,name,status").eq("id",groupId).maybeSingle(),
    service.from("realx_holding_group_vendors").select("vendor_id").eq("holding_group_id",groupId),
  ]);
  if(memberError)throw memberError;if(groupError)throw groupError;if(linkError)throw linkError;
  if(!member||member.disabled_at||!group||group.status!=="active")fail("This holding account is disabled",403);
  return {group,member,vendorIds:(links||[]).map((link:any)=>link.vendor_id)};
};
const getHoldingVendors=async(service:any,vendorIds:string[])=>{
  if(!vendorIds.length)return [];
  const {data:vendors,error}=await service.from("realx_vendors").select("id,name,status,vendor_type,payload").in("id",vendorIds);
  if(error)throw error;
  return (vendors||[]).map((vendor:any)=>({id:vendor.id,name:vendor.name||"Unnamed Vendor",nameAr:vendor.payload?.nameAr||null,email:vendor.payload?.email||null,status:vendor.status||null,vendorType:vendor.vendor_type||null,profilePicture:vendor.payload?.profilePicture||vendor.payload?.logo||vendor.payload?.logoUrl||null,activeOffers:Array.isArray(vendor.payload?.offers)?vendor.payload.offers.length:0}));
};
const holdingTransaction=(row:any)=>({...camelize(row),id:row.id,userId:row.student_id||null,vendorId:row.vendor_id||null,vendorName:row.vendor_name||"Unknown Vendor",type:row.transaction_type||row.type||"offer",totalAmount:Number(row.total_amount??row.amount??0),finalAmount:Number(row.final_amount??0),discountAmount:Number(row.discount_amount??0),createdAt:row.created_at,createdAtMillis:row.created_at?new Date(row.created_at).getTime():0});
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
const createAuthUser = async (service: any,input: any) => {
  const {data,error}=await service.auth.admin.createUser({
    email:String(input.email||"").trim().toLowerCase(),
    password:input.password||randomPassword(),email_confirm:true,
    user_metadata:{full_name:input.displayName||[input.firstName,input.lastName].filter(Boolean).join(" ")||input.name||""},
  });
  if(error)throw error;
  return data.user;
};
const insertAudit = async (service:any,actor:string,action:string,type:string,id:string|null,details:any={}) => {
  await service.from("realx_admin_audit_log").insert({actor_id:actor,action,entity_type:type,entity_id:id,details});
};
const sendPilotClaimPush = async (service:any,uid:string) => {
  const {data:rows,error}=await service.from("realx_push_tokens").select("id,token").eq("user_id",uid);
  if(error)throw error;
  const tokens=(rows||[]).filter((row:any)=>/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(row.token));
  if(!tokens.length)return {sent:0};
  const invalid:string[]=[];
  for(let offset=0;offset<tokens.length;offset+=100){
    const chunk=tokens.slice(offset,offset+100);
    const result=await fetch("https://exp.host/--/api/v2/push/send",{method:"POST",headers:{"Accept":"application/json","Accept-Encoding":"gzip, deflate","Content-Type":"application/json"},body:JSON.stringify(chunk.map((row:any)=>({to:row.token,sound:"sound.wav",title:"Your Badrgo ride is ready",body:"Open realX to view and copy your personal ride code.",data:{type:"pilot_coupon_claimed",campaignId:"badrgo-first-ride-2026",path:"/pilot/badrgo"},channelId:"reelx_general"})))});
    if(!result.ok)continue;
    const body=await result.json();(body.data||[]).forEach((ticket:any,index:number)=>{if(ticket.status==="error"&&["DeviceNotRegistered","InvalidCredentials"].includes(ticket.details?.error||""))invalid.push(chunk[index].id);});
  }
  if(invalid.length){const {error:removeError}=await service.from("realx_push_tokens").delete().in("id",invalid);if(removeError)throw removeError;}
  return {sent:tokens.length-invalid.length};
};
const assignCreatorCode = async (service:any,studentId:string) => {
  const {data:student,error:studentError}=await service.from("realx_students").select("creator_code").eq("id",studentId).maybeSingle();
  if(studentError)throw studentError;
  if(student?.creator_code)return student.creator_code;
  for(let attempt=0;attempt<8;attempt++){
    const code=randomCreatorCode();
    const {error}=await service.from("realx_creator_codes").insert({code,student_id:studentId});
    if(!error){
      const {error:updateError}=await service.from("realx_students").update({creator_code:code}).eq("id",studentId);
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
  const isHolding=role?.role==="holding_admin";
  const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const body=await request.json();
    const action=String(body.action||"");
    const data=body.data||{};
    if(!action)return response({error:"Action is required"},400);
    const requireAdmin=()=>{if(!isAdmin)fail("Admin access required",403);};
    const requireHolding=async()=>{
      const current=user;
      if(isAdmin)return current;
      if(!isHolding)fail("Holding account access required",403);
      const {data:member,error}=await service.from("realx_holding_group_members").select("disabled_at").eq("user_id",current.id).eq("holding_group_id",role.holding_group_id).maybeSingle();
      if(error)throw error;
      if(!member||member.disabled_at)fail("This holding account is disabled",403);
      const {data:group,error:groupError}=await service.from("realx_holding_groups").select("status").eq("id",role.holding_group_id).maybeSingle();
      if(groupError)throw groupError;if(!group||group.status!=="active")fail("This holding group is disabled",403);
      return current;
    };

    switch(action){
      case "syncVendorMapLocation": {
        requireAdmin();const vendorId=String(data.vendorId||"");if(!vendorId)fail("vendorId is required");
        return response({success:true,...await refreshVendorMap(service,vendorId)});
      }
      case "rebuildLocationsCache":
      case "rebuildMapLocationIndex": {
        requireAdmin();
        const vendors:any[]=[];for(let offset=0;;offset+=1000){const {data:page,error}=await service.from("realx_vendors").select("id,name,status,vendor_type,locations,payload").order("id").range(offset,offset+999);if(error)throw error;vendors.push(...(page||[]));if(!page||page.length<1000)break;}
        const fullCache=action==="rebuildLocationsCache"?{}:null;
        if(fullCache){const {error}=await service.from("realx_map_locations").delete().neq("id","");if(error)throw error;}
        else {const {error}=await service.from("realx_map_locations").delete().neq("id","");if(error)throw error;}
        const cache:any={};const rows:any[]=[];let vendorCount=0;
        for(const vendor of vendors){const result=buildVendorMapData(vendor);if(result.entry){cache[vendor.id]=result.entry;vendorCount++;}rows.push(...result.rows);}
        for(let offset=0;offset<rows.length;offset+=500){const {error}=await service.from("realx_map_locations").upsert(rows.slice(offset,offset+500));if(error)throw error;}
        if(action==="rebuildLocationsCache") {const {error}=await service.from("realx_map_cache").upsert({id:"locations",payload:cache,updated_at:new Date().toISOString()});if(error)throw error;}
        return response({success:true,vendorsScanned:vendors.length,vendorCount,locationCount:rows.length});
      }
      case "backfillVendorGeohashes": {
        requireAdmin();const limit=Math.max(1,Math.min(1000,Number(data.limit||500)));
        const {data:vendors,error}=await service.from("realx_vendors").select("id,payload").order("id").limit(limit);if(error)throw error;
        let updated=0;
        for(const vendor of vendors||[]){const lat=vendor.payload?.latitude??vendor.payload?.lat,lng=vendor.payload?.longitude??vendor.payload?.lng;if(!isCoordinate(lat,-90,90)||!isCoordinate(lng,-180,180))continue;const geohash=geohashForLocation(lat,lng).slice(0,5);if(vendor.payload?.geohash===geohash)continue;const {error:updateError}=await service.from("realx_vendors").update({payload:{...(vendor.payload||{}),geohash}}).eq("id",vendor.id);if(updateError)throw updateError;updated++;}
        return response({scanned:vendors?.length||0,updated,limit});
      }
      case "createStudentUser": {
        requireAdmin();
        const email=String(data.email||"").trim().toLowerCase();
        if(!email||!/^\S+@\S+\.\S+$/.test(email))fail("A valid email is required");
        if(data.role!==undefined&&!['student','creator'].includes(data.role))fail("Role must be student or creator");
        const created=await createAuthUser(service,data);
        const payload={uid:created.id,email:created.email,firstName:data.firstName||"",lastName:data.lastName||"",role:data.role||"student",gender:data.gender||null,dob:data.dob||null};
        const {error}=await service.from("realx_students").upsert({
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
          const {error:transactionError}=await service.from("realx_transactions").delete().eq("student_id",uid);
          if(transactionError)throw transactionError;
          const {error:authError}=await service.auth.admin.deleteUser(uid);
          if(authError&&authError.status!==404)throw authError;
        }else{
          const {error:vendorError}=await service.from("realx_vendors").delete().eq("id",uid);
          if(vendorError)throw vendorError;
          const {error:authError}=await service.auth.admin.deleteUser(uid);
          if(authError&&authError.status!==404)throw authError;
          try{
            const {data:objects}=await service.storage.from("realx-public-media").list(`vendors/${uid}/gallery`,{limit:1000});
            const files=(objects||[]).filter((item:any)=>item.id).map((item:any)=>`vendors/${uid}/gallery/${item.name}`);
            if(files.length)await service.storage.from("realx-public-media").remove(files);
          }catch(storageError){console.warn("Vendor gallery cleanup failed",String((storageError as any)?.message||storageError));}
        }
        await insertAudit(service,user.id,action,action==="deleteStudentUser"?"student":"vendor",uid);
        return response({success:true});
      }
      case "createVendorUser": {
        requireAdmin();
        const created=await createAuthUser(service,data);
        const vendor={id:created.id,user_id:created.id,name:String(data.name||"").trim(),status:"Active",vendor_type:"online",payload:{name:data.name,vendorType:"online",xcard:false}};
        const {error}=await service.from("realx_vendors").upsert(vendor);
        if(error)throw error;
        await service.from("realx_vendor_memberships").upsert({user_id:created.id,vendor_id:created.id,role:"owner"});
        await service.from("realx_user_roles").upsert({user_id:created.id,role:"vendor",vendor_id:created.id});
        await insertAudit(service,user.id,action,"vendor",created.id,{email:created.email});
        return response({uid:created.id,success:true});
      }
      case "approveVerificationRequest":
      case "rejectVerificationRequest": {
        requireAdmin();
        const id=String(data.verificationRequestId||"");
        if(!id)fail("verificationRequestId is required");
        const decision=action==="approveVerificationRequest"?"approved":"rejected";
        const {data:request,error:requestError}=await service.from("realx_verification_requests").select("email,requested_role,status,student_id").eq("id",id).maybeSingle();
        if(requestError)throw requestError;if(!request)fail("Verification request not found",404);
        let review:any;
        if(request.status==="pending"){
          const result=await caller.rpc("realx_review_verification_request",{p_request_id:id,p_decision:decision,p_reason:data.rejectionReason||null});
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
          const {error:studentError}=await service.from("realx_students").upsert({id:uid,email:review.email,first_name:profile.firstName,last_name:profile.lastName,account_role:accountRole,verification_status:"verified",profile,payload:profile});
          if(studentError)throw studentError;
          if(accountRole==="creator")creatorCode=await assignCreatorCode(service,uid);
          await service.from("realx_verification_requests").update({student_id:uid}).eq("id",id);
        } else {
          const {data:req}=await service.from("realx_verification_requests").select("id_image_path").eq("id",id).maybeSingle();
          if(req?.id_image_path)await service.storage.from("realx-student-documents").remove([String(req.id_image_path).replace(/^realx-student-documents\//,"")]);
          await service.from("realx_verification_requests").update({id_image_path:null}).eq("id",id);
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
        let q=service.from("realx_verification_requests").select("id,email,submitted_at,id_image_path").eq("status","pending").order("submitted_at",{ascending:true}).limit(pageSize);
        const cursorMillis=Number(data.cursorMillis||0);
        if(Number.isFinite(cursorMillis)&&cursorMillis>0)q=q.gt("submitted_at",new Date(cursorMillis).toISOString());
        const {data:rows,error}=await q;if(error)throw error;
        const bucket=service.storage.from("realx-student-documents");
        const requests=await Promise.all((rows||[]).map(async(row:any)=>{
          const path=String(row.id_image_path||"").replace(/^realx-student-documents\//,"");
          const signed=path?await bucket.createSignedUrl(path,3600):{data:null};
          return {requestId:row.id,email:row.email,submittedAt:row.submitted_at,idImageUrl:signed.data?.signedUrl||null};
        }));
        const last=rows?.at(-1)?.submitted_at;
        return response({requests,nextCursorMillis:rows?.length===pageSize&&last?new Date(last).getTime():null});
      }
      case "deleteVerificationRequest": {
        requireAdmin();
        const id=String(data.verificationRequestId||"");
        const {data:req,error}=await service.from("realx_verification_requests").select("id_image_path").eq("id",id).maybeSingle();
        if(error)throw error;if(!req)fail("Verification request not found",404);
        if(req.id_image_path)await service.storage.from("realx-student-documents").remove([String(req.id_image_path).replace(/^realx-student-documents\//,"")]);
        const {error:deleteError}=await service.from("realx_verification_requests").delete().eq("id",id);
        if(deleteError)throw deleteError;
        await insertAudit(service,user.id,action,"verification_request",id);
        return response({success:true});
      }
      case "sendNotification": {
        requireAdmin();
        const title=String(data.title||"").trim(), message=String(data.body||"").trim();
        const topic=String(data.topic||"all-users"),imageUrl=String(data.imageUrl||"").trim();
        if(!title||!message||title.length>100||message.length>500)fail("Title and body are required and must be within length limits");
        if(topic!=="all-users")fail("Only the all-users audience is currently supported");
        if(imageUrl){try{if(new URL(imageUrl).protocol!=="https:")throw new Error("HTTPS required");}catch{fail("Image URL must be a valid HTTPS URL");}}
        const dateKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Qatar",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
        const {data:quota,error:quotaError}=await service.rpc("realx_consume_notification_quota",{p_date_key:dateKey,p_daily_limit:2});
        if(quotaError)throw quotaError;if(!quota)fail("Daily notification limit of 2 reached",429);
        const {data:record,error}=await service.from("realx_notifications").insert({title,body:message,data:{imageUrl:imageUrl||null,topic},status:"queued",sent_by:user.id,date_key:dateKey}).select("id").single();
        if(error)throw error;
        const entries:any[]=[];
        for(let offset=0;;offset+=1000){const {data:page,error:tokenError}=await service.from("realx_push_tokens").select("id,user_id,token").order("id").range(offset,offset+999);if(tokenError)throw tokenError;entries.push(...(page||[]));if(!page||page.length<1000)break;}
        let sentCount=0,failedCount=0,invalidTokenCount=0;
        for(let offset=0;offset<entries.length;offset+=100){
          const chunk=entries.slice(offset,offset+100);
          const push=await fetch("https://exp.host/--/api/v2/push/send",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","Accept-Encoding":"gzip, deflate"},body:JSON.stringify(chunk.map((item:any)=>({to:item.token,title,body:message,sound:"sound.wav",channelId:"reelx_general",...(imageUrl?{richContent:{image:imageUrl}}:{}),data:{type:"admin_broadcast",campaignId:record.id,imageUrl:imageUrl||null}})))});
          if(!push.ok){failedCount+=chunk.length;continue;}
          const payload=await push.json();const tickets=Array.isArray(payload.data)?payload.data:[];
          const receipts:any[]=[];const invalidTokens:string[]=[];
          tickets.forEach((ticket:any,index:number)=>{const token=chunk[index];if(!token)return;if(ticket.status==="ok"){sentCount++;if(ticket.id)receipts.push({campaign_id:record.id,token_id:token.id,receipt_id:ticket.id,status:"pending"});}else{failedCount++;const reason=ticket.details?.error||null;if(["DeviceNotRegistered","InvalidCredentials"].includes(reason)){invalidTokenCount++;invalidTokens.push(token.token);}}});
          if(receipts.length){const {error:receiptError}=await service.from("realx_notification_deliveries").insert(receipts);if(receiptError)throw receiptError;}
          if(invalidTokens.length){const {error:removeError}=await service.from("realx_push_tokens").delete().in("token",invalidTokens);if(removeError)throw removeError;}
        }
        let receiptSuccess=0,receiptFailure=0;
        const pending:any[]=[];for(let offset=0;;offset+=500){const {data:page,error:pageError}=await service.from("realx_notification_deliveries").select("id,receipt_id,token_id").eq("campaign_id",record.id).eq("status","pending").range(offset,offset+499);if(pageError)throw pageError;pending.push(...(page||[]));if(!page||page.length<500)break;}
        for(let offset=0;offset<pending.length;offset+=300){const chunk=pending.slice(offset,offset+300);const receiptResponse=await fetch("https://exp.host/--/api/v2/push/getReceipts",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({ids:chunk.map((item:any)=>item.receipt_id)})});if(!receiptResponse.ok)continue;const receiptBody=await receiptResponse.json();for(const item of chunk){const receipt=receiptBody.data?.[item.receipt_id];if(!receipt)continue;const failed=receipt.status==="error";if(failed)receiptFailure++;else receiptSuccess++;if(failed&&["DeviceNotRegistered","InvalidCredentials"].includes(receipt.details?.error||"")){invalidTokenCount++;if(item.token_id)await service.from("realx_push_tokens").delete().eq("id",item.token_id);}await service.from("realx_notification_deliveries").update({status:failed?"error":"ok",details:receipt}).eq("id",item.id);}}
        const deliveryStatus=entries.length===0?"sent":failedCount===entries.length?"failed":"sent";
        const {error:updateError}=await service.from("realx_notifications").update({status:deliveryStatus,sent_count:sentCount,failed_count:failedCount,invalid_token_count:invalidTokenCount,total_registered:entries.length,receipt_success_count:receiptSuccess,receipt_failure_count:receiptFailure,completed_at:new Date().toISOString()}).eq("id",record.id);
        if(updateError)throw updateError;
        await insertAudit(service,user.id,action,"notification",record.id,{recipientCount:entries.length,sentCount,failedCount,invalidTokenCount,receiptSuccess,receiptFailure});
        return response({success:true,campaignId:record.id,status:deliveryStatus});
      }
      case "setVendorRedemptionPin": {
        requireAdmin();
        const pin=String(data.pin||"").replace(/[٠-٩۰-۹]/g,(digit:string)=>{const index="٠١٢٣٤٥٦٧٨٩".indexOf(digit);return String(index>=0?index:"۰۱۲۳۴۵۶۷۸۹".indexOf(digit));});
        const {error}=await caller.rpc("realx_set_vendor_redemption_pin",{p_vendor_id:String(data.vendorId||""),p_pin:pin});
        if(error)throw error;
        await insertAudit(service,user.id,action,"vendor",String(data.vendorId||""),{pinChanged:true});
        return response({success:true});
      }
      case "getBadrgoPilotAdminSummary": {
        requireAdmin();
        const [{data:campaign,error:campaignError},{data:codes,error:codesError},{data:claims,error:claimsError}]=await Promise.all([
          service.from("realx_pilot_campaigns").select("id,active,payload").eq("id","badrgo-first-ride-2026").maybeSingle(),
          service.from("realx_pilot_campaign_codes").select("id,pool,status",{count:"exact"}).eq("campaign_id","badrgo-first-ride-2026"),
          service.from("realx_pilot_campaign_claims").select("id",{count:"exact"}).eq("campaign_id","badrgo-first-ride-2026"),
        ]);
        if(campaignError)throw campaignError;if(codesError)throw codesError;if(claimsError)throw claimsError;
        if(!campaign)return response({exists:false});
        const assigned=(codes||[]).filter((row:any)=>row.status==="assigned");
        return response({exists:true,campaignId:campaign.id,brandName:"Badrgo",...campaign.payload,
          status:campaign.payload?.status||"draft",uiApproved:campaign.payload?.uiApproved===true,totalCodes:codes.count||0,
          publicLimit:80,reservedLimit:20,publicAssignedCount:assigned.filter((row:any)=>row.pool==="public").length,
          reservedAssignedCount:assigned.filter((row:any)=>row.pool==="reserved").length,claimCount:claims.count||0});
      }
      case "configureBadrgoPilotCampaign": {
        requireAdmin();
        const values:any={};
        for(const key of ["startsAt","endsAt"]){if(data[key]===null||data[key]===""||data[key]===undefined)values[key]=null;else{const parsed=new Date(String(data[key]));if(!Number.isFinite(parsed.getTime()))fail(`${key} must be a valid date`);values[key]=parsed.toISOString();}}
        for(const key of ["title","titleAr","description","descriptionAr","instructions","instructionsAr"]){const fallback=key==="title"?"Your next ride is on us":key==="titleAr"?"مشوارك القادم علينا":"";values[key]=String(data[key]||fallback).trim().slice(0,key.startsWith("title")?120:key.startsWith("description")?500:800)||fallback;}
        values.destinationUrl=String(data.destinationUrl||"").trim().slice(0,500);
        if(values.destinationUrl){try{if(new URL(values.destinationUrl).protocol!=="https:")throw new Error("HTTPS required");}catch{fail("Destination URL must use HTTPS");}}
        const {data:result,error}=await service.rpc("realx_configure_badrgo_pilot",{p_codes:data.codes,p_values:values});
        if(error)throw error;await insertAudit(service,user.id,action,"pilot_campaign","badrgo-first-ride-2026",{totalCodes:result?.totalCodes});return response(result);
      }
      case "setBadrgoPilotCampaignStatus": {
        requireAdmin();const status=String(data.status||"");if(!["active","paused","ended"].includes(status))fail("Unsupported campaign status");
        const {data:campaign,error}=await service.from("realx_pilot_campaigns").select("payload").eq("id","badrgo-first-ride-2026").maybeSingle();
        if(error)throw error;if(!campaign)fail("Configure the campaign first",409);
        const old=campaign.payload||{};if(old.status==="ended"&&status!=="ended")fail("An ended campaign cannot be reopened",409);
        if(status==="active"&&data.uiApproved!==true)fail("Partner UI approval must be confirmed before activation",409);
        if(status==="active"&&Number(old.totalCodes||0)!==100)fail("The complete code inventory is required",409);
        const next={...old,status,uiApproved:status==="active"?true:old.uiApproved===true,statusUpdatedBy:user.id,statusUpdatedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        const {error:updateError}=await service.from("realx_pilot_campaigns").update({active:status==="active",payload:next}).eq("id","badrgo-first-ride-2026");
        if(updateError)throw updateError;await insertAudit(service,user.id,action,"pilot_campaign","badrgo-first-ride-2026",{status});return response({success:true,status});
      }
      case "assignBadrgoReservedCoupon": {
        requireAdmin();const uid=String(data.uid||"").trim();const email=String(data.email||"").trim().toLowerCase();
        if(!uid&&!email)fail("A user ID or email is required");
        let query=service.from("realx_students").select("id,email");query=uid?query.eq("id",uid):query.eq("email",email);
        const {data:student,error}=await query.maybeSingle();if(error)throw error;if(!student)fail("Student profile not found",404);
        const {data:claim,error:claimError}=await service.rpc("realx_claim_badrgo_pilot_for",{p_student_id:student.id,p_pool:"reserved",p_assigned_by:user.id});
        if(claimError)throw claimError;let push={sent:0};if(!claim?.existing)push=await sendPilotClaimPush(service,student.id).catch(()=>({sent:0}));
        await insertAudit(service,user.id,action,"pilot_campaign_claim",String(student.id),{pool:"reserved",existing:Boolean(claim?.existing)});
        return response({success:true,uid:student.id,email:student.email||null,existing:Boolean(claim?.existing),reservedAssigned:claim?.pool==="reserved",notificationSent:push.sent>0});
      }
      case "migrateBadrgoPilotToVoucherProgram": {
        requireAdmin();const {data:result,error}=await service.rpc("realx_migrate_badrgo_pilot_to_vouchers",{p_admin_id:user.id});
        if(error)throw error;await insertAudit(service,user.id,action,"voucher_program","badrgo-rides",result||{});return response(result);
      }
      case "getBadrgoVoucherAdminSummary": {
        requireAdmin();
        const [program,codes,available,assigned,redeemed,claims,batches,recent,legacy]=await Promise.all([
          service.from("realx_badrgo_voucher_programs").select("*").eq("id","badrgo-rides").maybeSingle(),
          service.from("realx_badrgo_voucher_inventory").select("id",{count:"exact",head:true}).eq("program_id","badrgo-rides"),
          service.from("realx_badrgo_voucher_inventory").select("id",{count:"exact",head:true}).eq("program_id","badrgo-rides").eq("status","available"),
          service.from("realx_badrgo_voucher_inventory").select("id",{count:"exact",head:true}).eq("program_id","badrgo-rides").eq("status","assigned"),
          service.from("realx_badrgo_voucher_inventory").select("id",{count:"exact",head:true}).eq("program_id","badrgo-rides").eq("status","redeemed"),
          service.from("realx_badrgo_voucher_claims").select("*",{count:"exact"}).eq("program_id","badrgo-rides").order("claimed_at",{ascending:false}).limit(20),
          service.from("realx_inventory_batches").select("*").eq("program_id","badrgo-rides").order("created_at",{ascending:false}).limit(20),
          service.from("realx_badrgo_voucher_claims").select("id,student_id,week_key,claimed_at").eq("program_id","badrgo-rides").order("claimed_at",{ascending:false}).limit(20),
          service.from("realx_pilot_campaigns").select("id").eq("id","badrgo-first-ride-2026").maybeSingle(),
        ]);
        for(const result of [program,codes,available,assigned,redeemed,claims,batches,recent,legacy])if(result.error)throw result.error;
        const claimRows=recent.data||[];
        const programData=program.data;
        return response({exists:Boolean(programData),status:programData?.payload?.status||(programData?.active?"active":"paused"),totalCodes:codes.count||0,availableCount:available.count||0,redeemedCount:redeemed.count||0,assignedActiveCount:assigned.count||0,totalClaims:claims.count||0,maxImportCodes:5000,legacyMigrationAvailable:Boolean(legacy.data)&&!programData?.payload?.legacyPilotMigration,batches:(batches.data||[]).map((row:any)=>({...camelize(row),...(row.payload||{})})),redemptionImports:(await service.from("realx_redemption_imports").select("*").eq("program_id","badrgo-rides").order("created_at",{ascending:false}).limit(10)).data?.map((row:any)=>({...camelize(row),...(row.payload||{})}))||[],recentClaims:claimRows.map(camelize),...(programData?.payload||{})});
      }
      case "importBadrgoVoucherCodes": {
        requireAdmin();
        if(!Array.isArray(data.codes)||data.codes.length<1)fail("At least one voucher code is required");
        const codes=data.codes.map((v:any)=>{if(typeof v!=="string")fail("Every voucher code must be text");const code=v.trim().toUpperCase();if(!/^[A-Z0-9_-]{6,64}$/.test(code))fail("Codes must contain 6-64 letters, numbers, underscores, or hyphens");return code;});
        if(new Set(codes).size!==codes.length)fail("The import contains duplicate voucher codes");
        if(codes.length>5000)fail("A maximum of 5000 voucher codes can be imported");
        const hashes=await Promise.all(codes.map((code:string)=>sha256("badrgo-rides:"+code)));
        const existing=new Set<string>();
        for(let start=0;start<hashes.length;start+=500){
          const chunk=hashes.slice(start,start+500);if(!chunk.length)continue;
          const {data:rows,error}=await service.from("realx_badrgo_voucher_inventory").select("code_hash").in("code_hash",chunk);
          if(error)throw error;for(const row of rows||[])existing.add(row.code_hash);
        }
        const importId=String(data.importId||crypto.randomUUID());
        if(!/^[A-Za-z0-9_-]{8,80}$/.test(importId))fail("Invalid voucher import ID");
        const records=codes.map((code:string,index:number)=>({code,index})).filter((item:any)=>!existing.has(hashes[item.index])).map((item:any)=>({program_id:"badrgo-rides",code_value:item.code,code_hash:hashes[item.index],import_id:importId,batch_id:importId}));
        let accepted=0;
        for(let start=0;start<records.length;start+=500){
          const {data:inserted,error}=await service.from("realx_badrgo_voucher_inventory").insert(records.slice(start,start+500)).select("id");
          if(error)throw error;accepted+=(inserted||[]).length;
        }
        const failedCount=0;
        const {error:batchError}=await service.from("realx_inventory_batches").upsert({id:importId,program_id:"badrgo-rides",imported_by:user.id,record_count:accepted,payload:{acceptedCount:accepted,duplicateCount:codes.length-accepted,failedCount,status:"complete",requestedCount:codes.length},created_at:new Date().toISOString()});
        if(batchError)throw batchError;
        await insertAudit(service,user.id,action,"voucher_batch",importId,{accepted});
        return response({acceptedCount:accepted,duplicateCount:codes.length-accepted,failedCount});
      }
      case "importBadrgoVoucherRedemptions": {
        requireAdmin();
        const codes=data.codes;
        const importId=String(data.importId||crypto.randomUUID());
        const {data:result,error}=await caller.rpc("realx_import_badrgo_redemptions",{p_codes:codes,p_import_id:importId});
        if(error)throw error;
        await insertAudit(service,user.id,action,"voucher_redemption_import",importId,result||{});
        return response(result);
      }
      case "setBadrgoVoucherProgramStatus": {
        requireAdmin();
        const status=String(data.status||"");
        if(!["active","paused","ended"].includes(status))fail("Invalid program status");
        const {data:old}=await service.from("realx_badrgo_voucher_programs").select("payload").eq("id","badrgo-rides").maybeSingle();
        if(old?.payload?.status==="ended"&&status!=="ended")fail("An ended program cannot be reopened",409);
        if(status==="active"){
          const {count,error:countError}=await service.from("realx_badrgo_voucher_inventory").select("id",{count:"exact",head:true}).eq("program_id","badrgo-rides").eq("status","available");
          if(countError)throw countError;if(!count)fail("Import available codes before activation",409);
        }
        const {error}=await service.from("realx_badrgo_voucher_programs").update({active:status==="active",payload:{...(old?.payload||{}),status}}).eq("id","badrgo-rides");
        if(error)throw error;return response({success:true});
      }
      case "updateBadrgoVoucherProgram": {
        requireAdmin();
        const fields={title:String(data.title||""),titleAr:String(data.titleAr||""),description:String(data.description||""),descriptionAr:String(data.descriptionAr||""),instructions:String(data.instructions||""),instructionsAr:String(data.instructionsAr||""),destinationUrl:String(data.destinationUrl||"")};
        if(fields.destinationUrl){try{if(new URL(fields.destinationUrl).protocol!=="https:")throw new Error("HTTPS required");}catch{fail("Destination URL must use HTTPS");}}
        const {data:old}=await service.from("realx_badrgo_voucher_programs").select("payload").eq("id","badrgo-rides").maybeSingle();
        const {error}=await service.from("realx_badrgo_voucher_programs").update({name:fields.title||"Badrgo rides",payload:{...(old?.payload||{}),...fields}}).eq("id","badrgo-rides");
        if(error)throw error;return response({success:true});
      }
      case "deleteTransaction": {
        requireAdmin();
        const id=String(data.transactionId||"");if(!id)fail("transactionId is required");
        const {error}=await service.from("realx_transactions").delete().eq("id",id);if(error)throw error;
        await insertAudit(service,user.id,action,"transaction",id);return response({success:true});
      }
      case "getAdminBigQueryDashboard": {
        requireAdmin();
        const range=String(data.range||"6mo");
        const days=range==="30d"?30:range==="90d"?90:182;
        const now=new Date(),start=new Date(now.getTime()-days*86400000);
        const {data:rows,error}=await service.from("realx_transactions").select("id,student_id,vendor_id,vendor_name,transaction_type,status,total_amount,final_amount,created_at").neq("transaction_type","online").gte("created_at",start.toISOString()).order("created_at",{ascending:true}).limit(5000);
        if(error)throw error;
        const all=rows||[];
        const completed=all.filter((row:any)=>row.status==="completed");
        const bucket=range==="30d"?"day":range==="90d"?"week":"month";
        const trend=new Map<string,{transactions:number;value:number}>();
        const labelFor=(date:Date)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Qatar",day:"2-digit",month:"short",...(bucket==="month"?{year:undefined}:{})}).format(date);
        for(const row of all){
          const date=new Date(row.created_at);let key:string;
          if(bucket==="month"){key=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Qatar",year:"numeric",month:"2-digit"}).format(date);}
          else if(bucket==="week"){const local=new Date(date.getTime()+3*3600000);const day=local.getUTCDay()||7;local.setUTCDate(local.getUTCDate()-day+1);key=local.toISOString().slice(0,10);}
          else key=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Qatar",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
          const value=trend.get(key)||{transactions:0,value:0};value.transactions++;value.value+=Number(row.final_amount??row.total_amount??0);trend.set(key,value);
        }
        const vendors=new Map<string,{name:string;sales:number}>();
        for(const row of completed){const key=String(row.vendor_id||"");const value=vendors.get(key)||{name:row.vendor_name||"Unknown Vendor",sales:0};value.sales+=Number(row.total_amount||0);vendors.set(key,value);}
        const recent=completed.slice().sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,20);
        return response({
          stats:{transactingStudents:new Set(completed.map((row:any)=>row.student_id)).size,transactingVendors:new Set(completed.map((row:any)=>row.vendor_id)).size,offerRedemptions:completed.filter((row:any)=>row.transaction_type==="offer").length,transactions:completed.length,transactionValue:completed.reduce((n:number,row:any)=>n+Number(row.final_amount??row.total_amount??0),0)},
          transactionTrend:[...trend.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({label:bucket==="month"?key.slice(5):labelFor(new Date(key+"T12:00:00Z")),...value})),
          transactionBreakdown:[...new Set(completed.map((row:any)=>row.transaction_type))].map((type:any)=>{const list=completed.filter((row:any)=>row.transaction_type===type);return{type,transactions:list.length,value:list.reduce((n:number,row:any)=>n+Number(row.final_amount??row.total_amount??0),0)}}),
          topVendors:[...vendors.values()].sort((a,b)=>b.sales-a.sales).slice(0,10),
          recentActivity:recent.map((row:any)=>({id:row.id,studentName:row.student_id||"Unknown Student",vendorName:row.vendor_name||"Unknown Vendor",amount:Number(row.final_amount??row.total_amount??0),createdAt:row.created_at,status:row.status})),
          query:{durationMs:0,bytesProcessed:0,bytesBilled:0,cacheHit:false},freshness:recent[0]?.created_at||null,
        });
      }
      case "listAdminBigQueryTransactions":
      case "getAdminBigQueryTransactions": {
        requireAdmin();
        const size=Math.min(100,Math.max(1,Number(data.pageSize||10)));
        const sorts:Record<string,{field:string;ascending:boolean}>={date_asc:{field:"created_at",ascending:true},date_desc:{field:"created_at",ascending:false},amount_asc:{field:"total_amount",ascending:true},amount_desc:{field:"total_amount",ascending:false},vendor_asc:{field:"vendor_name",ascending:true},vendor_desc:{field:"vendor_name",ascending:false}};
        const sort=sorts[String(data.sort||"date_desc")];if(!sort)fail("Unsupported transaction sort");
        let q=service.from("realx_transactions").select("*",{count:"exact"}).neq("transaction_type","online").order(sort.field,{ascending:sort.ascending,nullsFirst:false}).order("id",{ascending:sort.ascending}).limit(size+1);
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
        return response({transactions,nextCursor:hasNext&&last?encodeCursor({value:last[sort.field]??(sort.ascending?"":""),id:last.id}):null,query:{durationMs:0,bytesProcessed:0,bytesBilled:0,cacheHit:false},freshness:page[0]?.created_at||null,totalCount:count||0});
      }
      case "listHoldingGroups": {
        requireAdmin();
        const [{data:groups,error:groupError},{data:members,error:memberError}]=await Promise.all([
          service.from("realx_holding_groups").select("*").order("name"),
          service.from("realx_holding_group_members").select("id,user_id,holding_group_id,role,disabled_at,payload"),
        ]);
        if(groupError)throw groupError;if(memberError)throw memberError;
        const groupsWithRelations=await Promise.all((groups||[]).map(async(group:any)=>{
          const [{data:links,error:linkError},{data:groupMembers,error:usersError}]=await Promise.all([
            service.from("realx_holding_group_vendors").select("vendor_id").eq("holding_group_id",group.id),
            Promise.resolve({data:(members||[]).filter((member:any)=>member.holding_group_id===group.id),error:null}),
          ]);
          if(linkError)throw linkError;if(usersError)throw usersError;
          const users=await Promise.all((groupMembers||[]).map(async(member:any)=>{
            const {data:authUser}=await service.auth.admin.getUserById(member.user_id);
            return {uid:member.user_id,email:authUser?.user?.email||member.payload?.email||"",displayName:authUser?.user?.user_metadata?.full_name||member.payload?.displayName||"",role:member.role||"viewer",status:member.disabled_at?"disabled":"active"};
          }));
          return {id:group.id,name:group.name||"Unnamed Group",status:group.status||"disabled",vendorIds:(links||[]).map((link:any)=>link.vendor_id),users,createdAt:group.created_at,updatedAt:group.updated_at};
        }));
        return response({groups:groupsWithRelations});
      }
      case "createHoldingGroup": {
        requireAdmin();
        const name=String(data.name||"").trim();if(!name)fail("Group name is required");
        const vendorIds=Array.isArray(data.vendorIds)?[...new Set(data.vendorIds.map(String))]:[];
        if(vendorIds.length){const {data:existing,error:vendorError}=await service.from("realx_vendors").select("id").in("id",vendorIds);if(vendorError)throw vendorError;if((existing||[]).length!==vendorIds.length)fail("One or more vendors do not exist");}
        const {data:group,error}=await service.from("realx_holding_groups").insert({name,status:"active",payload:{name,status:"active"}}).select("id").single();
        if(error)throw error;
        const vendors=(data.vendorIds||[]).map((vendorId:string)=>({holding_group_id:group.id,vendor_id:vendorId}));
        if(vendors.length){const result=await service.from("realx_holding_group_vendors").insert(vendors);if(result.error)throw result.error;}
        await insertAudit(service,user.id,action,"holding_group",group.id);
        return response({groupId:group.id,success:true});
      }
      case "updateHoldingGroup": {
        requireAdmin();
        const id=String(data.groupId||"");
        if(!id)fail("groupId is required");
        const patch:any={};if(data.name!==undefined){patch.name=String(data.name).trim();if(!patch.name)fail("Group name is required");}if(data.status!==undefined){if(!["active","disabled"].includes(data.status))fail("Status must be active or disabled");patch.status=data.status;}
        const {error}=await service.from("realx_holding_groups").update(patch).eq("id",id);if(error)throw error;
        if(Array.isArray(data.vendorIds)){
          const vendorIds=[...new Set(data.vendorIds.map(String))];
          if(vendorIds.length){const {data:existing,error:vendorError}=await service.from("realx_vendors").select("id").in("id",vendorIds);if(vendorError)throw vendorError;if((existing||[]).length!==vendorIds.length)fail("One or more vendors do not exist");}
          const {error:deleteLinksError}=await service.from("realx_holding_group_vendors").delete().eq("holding_group_id",id);if(deleteLinksError)throw deleteLinksError;
          const rows=vendorIds.map((vendorId:string)=>({holding_group_id:id,vendor_id:vendorId}));
          if(rows.length){const result=await service.from("realx_holding_group_vendors").insert(rows);if(result.error)throw result.error;}
        }
        return response({success:true});
      }
      case "createHoldingGroupUser": {
        requireAdmin();
        const groupId=String(data.groupId||"");if(!groupId)fail("groupId is required");
        if(!["owner","viewer"].includes(data.role||"viewer"))fail("role must be owner or viewer");
        const {data:group,error:groupError}=await service.from("realx_holding_groups").select("id").eq("id",groupId).maybeSingle();if(groupError)throw groupError;if(!group)fail("Holding group not found",404);
        if(!String(data.password||""))fail("password is required");if(!String(data.displayName||"").trim())fail("displayName is required");
        const created=await createAuthUser(service,{...data,displayName:data.displayName});
        const {error}=await service.from("realx_holding_group_members").upsert({holding_group_id:groupId,user_id:created.id,role:data.role||"viewer",payload:{email:created.email,displayName:data.displayName,status:"active"}});
        if(error)throw error;
        await service.from("realx_user_roles").upsert({user_id:created.id,role:"holding_admin",holding_group_id:groupId});
        return response({uid:created.id,success:true});
      }
      case "disableHoldingGroupUser": {
        requireAdmin();const uid=String(data.uid||"");
        const {data:member,error:readError}=await service.from("realx_holding_group_members").select("id,payload").eq("user_id",uid).maybeSingle();
        if(readError)throw readError;if(!member)fail("Holding user not found",404);
        const {error}=await service.from("realx_holding_group_members").update({disabled_at:new Date().toISOString(),payload:{...(member.payload||{}),status:"disabled"}}).eq("user_id",uid);
        if(error)throw error;
        await service.auth.admin.updateUserById(uid,{ban_duration:"876000h"}).catch(()=>undefined);
        return response({success:true});
      }
      case "deleteHoldingGroupUser": {
        requireAdmin();const uid=String(data.uid||"");
        await Promise.allSettled([
          service.auth.admin.deleteUser(uid),
          service.from("realx_holding_group_members").delete().eq("user_id",uid),
          service.from("realx_user_roles").delete().eq("user_id",uid),
        ]);
        return response({success:true});
      }
      case "getMyHoldingProfile": {
        const current=requireUser();
        if(!isHolding)fail("Holding account access required",403);
        const access=await getHoldingScope(service,current.id,role);
        const vendors=await getHoldingVendors(service,access.vendorIds);
        return response({uid:current.id,groupId:access.group.id,groupName:access.group.name,role:access.member.role||"viewer",status:"active",vendorIds:access.vendorIds,vendors});
      }
      case "getHoldingDashboard": {
        const current=requireUser();
        if(!isHolding)fail("Holding account access required",403);
        const access=await getHoldingScope(service,current.id,role);
        const range=String(data.range||"7d");if(!["7d","30d","90d"].includes(range))fail("Unsupported range");
        const rangeDays=range==="7d"?7:range==="30d"?30:90;
        const vendors=await getHoldingVendors(service,access.vendorIds);
        const qatarDay=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Qatar",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
        const todayKey=qatarDay(new Date());const todayUtc=Date.parse(todayKey+"T00:00:00Z");
        const daily:Record<string,{date:string;redemptions:number;revenue:number}>={};
        for(let i=rangeDays-1;i>=0;i--){const key=new Date(todayUtc-i*86400000).toISOString().slice(0,10);daily[key]={date:key,redemptions:0,revenue:0};}
        const totals={totalRevenue:0,totalRedemptions:0,totalDiscount:0,pendingTransactions:0,activeOffers:vendors.reduce((sum:number,v:any)=>sum+v.activeOffers,0)};
        const breakdown=new Map(vendors.map((vendor:any)=>[vendor.id,{vendorId:vendor.id,vendorName:vendor.name,totalRevenue:0,totalRedemptions:0,totalDiscount:0,pendingTransactions:0,activeOffers:vendor.activeOffers}]));
        const rows:any[]=[];
        if(access.vendorIds.length){for(let offset=0;;offset+=1000){const {data:page,error}=await service.from("realx_transactions").select("*").in("vendor_id",access.vendorIds).order("created_at",{ascending:false}).range(offset,offset+999);if(error)throw error;rows.push(...(page||[]));if(!page||page.length<1000)break;}}
        const startKey=new Date(todayUtc-(rangeDays-1)*86400000).toISOString().slice(0,10);
        for(const row of rows){const stats:any=breakdown.get(row.vendor_id);if(!stats)continue;if(row.status==="pending"){totals.pendingTransactions++;stats.pendingTransactions++;}if(row.status!=="completed")continue;
          const revenue=Number(row.final_amount||0),discount=Number(row.discount_amount||0);totals.totalRevenue+=revenue;totals.totalDiscount+=discount;totals.totalRedemptions++;stats.totalRevenue+=revenue;stats.totalDiscount+=discount;stats.totalRedemptions++;
          const day=qatarDay(new Date(row.created_at));if(day>=startKey&&daily[day]){daily[day].redemptions++;daily[day].revenue+=revenue;}
        }
        return response({groupId:access.group.id,groupName:access.group.name,totals,chartData:Object.values(daily),vendors:[...breakdown.values()]});
      }
      case "listHoldingTransactions": {
        const current=requireUser();if(!isHolding)fail("Holding account access required",403);
        const access=await getHoldingScope(service,current.id,role);const pageSize=Number(data.pageSize||50);
        if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100)fail("pageSize must be from 1 to 100");
        let q=service.from("realx_transactions").select("*",{count:"exact"}).in("vendor_id",access.vendorIds).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(pageSize+1);
        if(data.vendorId){if(!access.vendorIds.includes(String(data.vendorId)))fail("Vendor is not assigned",403);q=q.eq("vendor_id",data.vendorId);}
        if(data.cursor){const cursor=decodeCursor(String(data.cursor));if(!cursor||typeof cursor.createdAt!=="string"||typeof cursor.id!=="string")fail("Invalid holding transaction cursor");q=q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);}
        const {data:rows,error,count}=await q;if(error)throw error;
        const all=rows||[],hasNext=all.length>pageSize,page=all.slice(0,pageSize),last=page.at(-1);
        return response({transactions:page.map(holdingTransaction),totalCount:count||0,nextCursor:hasNext&&last?encodeCursor({createdAt:last.created_at,id:last.id}):null});
      }
      case "getHoldingTransaction": {
        const current=requireUser();if(!isHolding)fail("Holding account access required",403);
        const access=await getHoldingScope(service,current.id,role);
        const {data:txn,error}=await service.from("realx_transactions").select("*").eq("id",data.transactionId).in("vendor_id",access.vendorIds).maybeSingle();
        if(error)throw error;if(!txn)fail("Transaction not found",404);
        return response({transaction:holdingTransaction(txn)});
      }
      default:
        fail("Unknown admin action: "+action,404);
    }
  } catch(error) {
    const status=Number((error as any)?.status||500);
    console.error("realx-admin-action",String((error as any)?.message||error));
    return response({error:(error as any)?.message||"Admin action failed"},status);
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-wakti-api-key","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const errorReply=(error:any)=>reply({error:error?.message||"Request failed",code:error?.code},Number(error?.status||400));
const sha256=async(value:string)=>{const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");};
const hmac=async(secret:string,value:string)=>{const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));return [...bytes].map(v=>v.toString(16).padStart(2,"0")).join("");};
const randomCode=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,"0");
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
const base64ToBytes=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const normalizeEmail=(value:unknown)=>String(value||"").trim().toLowerCase();
const isEmail=(value:string)=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
const normalizeDigits=(value:any)=>String(value??"").replace(/[٠-٩۰-۹]/g,(digit)=>{const arabic="٠١٢٣٤٥٦٧٨٩",persian="۰۱۲۳۴۵۶۷۸۹";const i=arabic.indexOf(digit);return String(i>-1?i:persian.indexOf(digit));});
const asRows=(response:any)=>response.data||[];
async function existsStudent(service:any,email:string){const {data,error}=await service.from("realx_students").select("id").eq("email",email).limit(1);if(error)throw error;return Boolean(data?.length);}
async function allowedSchoolEmail(_service:any,email:string){const domain=email.split("@")[1]?.toLowerCase();const allowed=new Set(["gemsed.com","dpsmisdoha.com","oliveschooldoha.com","rajagiridoha.com","education.qa","americanacademy.sch.qa","student.ukm.qa","miesppu.edu.qa","abdn.ac.uk","ulster.ac.uk","student.dbs.sch.qa","student.dbsrawdat.com","asd.equ.qa","qu.edu.qa","oryx.edu.qa","lu.edu.qa","tamu.edu","smail.astate.edu","hbku.edu.qa","andrew.cmu.edu"]);return Boolean(domain&&(domain.endsWith(".qa")||allowed.has(domain)));}
async function roleOf(client:any,uid:string){const {data,error}=await client.from("realx_user_roles").select("role").eq("user_id",uid).maybeSingle();if(error)throw error;return data?.role||null;}
async function incrementRateLimit(service:any,key:string,limit:number,windowSeconds:number){
  const {data,error}=await service.rpc("realx_increment_rate_limit",{p_key:key,p_limit:limit,p_window_seconds:windowSeconds});
  if(error)throw error;if(!data)throw Object.assign(new Error("Too many requests. Please try again later."),{status:429});
}
const safeHttpsUrl=(value:unknown)=>{
  if(typeof value!=="string")return null;
  try{const parsed=new URL(value);if(parsed.protocol!=="https:"||!parsed.hostname||parsed.username||parsed.password)return null;return parsed.toString();}catch{return null;}
};
async function getEligibleOnlineVendor(service:any,uid:string,vendorId:string){
  const [{data:student,error:studentError},{data:vendor,error:vendorError},{data:config,error:configError}]=await Promise.all([
    service.from("realx_students").select("profile").eq("id",uid).maybeSingle(),
    service.from("realx_vendors").select("id,name,status,vendor_type,payload").eq("id",vendorId).maybeSingle(),
    service.from("realx_vendor_online_configs").select("*").eq("vendor_id",vendorId).eq("active",true).maybeSingle(),
  ]);
  if(studentError)throw studentError;if(vendorError)throw vendorError;if(configError)throw configError;
  if(!student)throw Object.assign(new Error("Student profile not found"),{status:404});
  if(student.profile?.redemptionDisabled===true||student.profile?.accountType==="browse_only")throw Object.assign(new Error("This account cannot access online vendor offers"),{status:403});
  if(!vendor)throw Object.assign(new Error("Vendor not found"),{status:404});
  if(vendor.vendor_type!=="online"||vendor.status==="Inactive"||vendor.payload?.isActive===false)throw Object.assign(new Error("This online vendor is disabled"),{status:400});
  if(!config||config.offer?.enabled!==true)throw Object.assign(new Error("Online vendor access is not enabled"),{status:400});
  const offer=config.offer||{};
  const purchaseUrl=safeHttpsUrl(offer.purchaseUrl||config.destination_url);
  const iosUrl=safeHttpsUrl(offer.iosUrl)||purchaseUrl;
  const androidUrl=safeHttpsUrl(offer.androidUrl)||purchaseUrl;
  const fulfillmentMode=offer.fulfillmentMode==="coupon"?"coupon":"link";
  const discountCode=typeof offer.discountCode==="string"?offer.discountCode.trim().slice(0,160):"";
  if(fulfillmentMode==="coupon"&&(!discountCode||!purchaseUrl))throw Object.assign(new Error("Online vendor discount code is not configured"),{status:400});
  if(fulfillmentMode!=="coupon"&&!purchaseUrl&&!iosUrl&&!androidUrl)throw Object.assign(new Error("Online vendor destination is not configured"),{status:400});
  return {vendorData:{...vendor.payload,name:vendor.name,vendorType:vendor.vendor_type},fulfillmentMode,discountCode:discountCode||null,purchaseUrl,iosUrl,androidUrl,ctaLabel:offer.ctaLabel||null,ctaLabelAr:offer.ctaLabelAr||null,instructions:offer.instructions||null,instructionsAr:offer.instructionsAr||null,dailyLimitPerUser:2147483647,remainingToday:2147483647};
}
async function sendExpoPushToUser(service:any,uid:string,message:Record<string,unknown>){
  const {data:rows,error}=await service.from("realx_push_tokens").select("token").eq("user_id",uid);
  if(error)throw error;
  const tokens=(rows||[]).map((row:any)=>String(row.token||"")).filter((token:string)=>/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token));
  const invalid:string[]=[];
  for(let offset=0;offset<tokens.length;offset+=100){
    const chunk=tokens.slice(offset,offset+100);
    const result=await fetch("https://exp.host/--/api/v2/push/send",{method:"POST",headers:{Accept:"application/json","Accept-Encoding":"gzip, deflate","Content-Type":"application/json"},body:JSON.stringify(chunk.map((to:string)=>({to,sound:"default",...message})))});
    if(!result.ok)throw new Error("Push notification delivery failed");
    const payload=await result.json();
    (payload.data||[]).forEach((ticket:any,index:number)=>{if(ticket.status==="error"&&["DeviceNotRegistered","InvalidCredentials"].includes(ticket.details?.error||""))invalid.push(chunk[index]);});
  }
  if(invalid.length)await service.from("realx_push_tokens").delete().in("token",invalid);
}
async function sendResendEmail(email:string,code:string,purpose:string){
  const apiKey=Deno.env.get("RESEND_API_KEY");if(!apiKey)throw Object.assign(new Error("Email delivery is not configured for verification codes."),{status:503});
  const from=Deno.env.get("RESEND_FROM_EMAIL")||"Kouponly <verification@kouponly.com>";
  const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:purpose==="verification"?"Verify your email":"Your Kouponly sign in code",text:"Your verification code is "+code+". It expires in five minutes."})});
  if(!result.ok)throw Object.assign(new Error("Could not send the verification email."),{status:502});
}
Deno.serve(async(request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="POST")return reply({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL");const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!serviceKey)return reply({error:"Supabase server configuration is incomplete"},500);
  const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const input=await request.json();const action=String(input.action||"");const data=input.data||{};
    if(action==="verifyWaktiStudent"){
      const expected=Deno.env.get("WAKTI_API_KEY"),provided=request.headers.get("x-wakti-api-key");
      const email=normalizeEmail(data.email);if(!isEmail(email))return reply({error:"Valid email required"},400);
      let verifiedUser:any=null;
      if(!expected||!provided||provided!==expected){
        const bearer=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
        if(!bearer)return reply({error:"Unauthorized"},401);
        const checkClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+bearer}},auth:{persistSession:false}});
        const {data:{user:current},error:authError}=await checkClient.auth.getUser(bearer);
        if(authError||!current||normalizeEmail(current.email)!==email)return reply({error:"You can only check the signed-in email address"},403);
        verifiedUser=current;
      }
      const {data:student,error:studentError}=await service.from("realx_students").select("id").eq("email",email).maybeSingle();
      if(studentError)throw studentError;
      const isStudent=Boolean(student);
      const {error}=await service.from("realx_wakti_student_verification_requests").insert({email,student_id:student?.id||verifiedUser?.id||null,status:"success",payload:{isStudent}});
      if(error)throw error;return reply({isStudent});
    }
    const bearer=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    const client=createClient(url,anon,{global:{headers:bearer?{Authorization:"Bearer "+bearer}:{}} ,auth:{persistSession:false}});
    let user:any=null;
    if(bearer){const result=await client.auth.getUser(bearer);if(!result.error)user=result.data.user;}
    const requireUser=()=>{if(!user)throw Object.assign(new Error("Login required"),{status:401});return user;};
    const requireAdmin=async()=>{const current=requireUser();if(await roleOf(client,current.id)!=="admin")throw Object.assign(new Error("Admin access required"),{status:403});return current;};
    switch(action){
      case "checkStudentExists":
      case "checkStudentExistsLogin": {
        const email=normalizeEmail(data.email);if(!isEmail(email))throw Object.assign(new Error("Valid email required"),{status:400});
        const ip=request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
        await incrementRateLimit(service,await sha256(action+":"+email+":"+ip),20,900);
        if(action==="checkStudentExists"&&!await allowedSchoolEmail(service,email))throw Object.assign(new Error("Only approved school emails can sign up"),{status:403});
        return reply({exists:await existsStudent(service,email)});
      }
      case "sendOtp": {
        const email=normalizeEmail(data.email),purpose=String(data.purpose||"");
        if(!isEmail(email)||!["signup","login","verification"].includes(purpose))throw Object.assign(new Error("A valid email and OTP purpose are required"),{status:400});
        const ip=request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
        await incrementRateLimit(service,await sha256("send:"+email+":"+purpose+":"+ip),5,900);
        if(purpose==="signup"&&!await allowedSchoolEmail(service,email))throw Object.assign(new Error("Only approved school emails can sign up"),{status:403});
        if(purpose==="verification"&&await allowedSchoolEmail(service,email))throw Object.assign(new Error("Please use regular signup with your school email"),{status:400});
        if(purpose!=="login"&&await existsStudent(service,email))throw Object.assign(new Error("An account with this email already exists"),{status:409});
        if(purpose==="login"&&!await existsStudent(service,email)){
          const {data:approved,error}=await service.from("realx_verification_requests").select("id").eq("email",email).eq("status","approved").limit(1);
          if(error)throw error;if(!approved?.length)throw Object.assign(new Error("No account found with this email"),{status:404});
        }
        if(purpose!=="verification"){
          const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:purpose==="signup"}});
          if(error)throw error;
          return reply({success:true,expiresIn:300});
        }
        const {data:latest,error:latestError}=await service.from("realx_otp_challenges").select("created_at").eq("email",email).eq("purpose",purpose).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(latestError)throw latestError;
        if(latest?.created_at&&Date.now()-new Date(latest.created_at).getTime()<60_000)throw Object.assign(new Error("Please wait before requesting another code."),{status:429});
        const code=randomCode(),secret=Deno.env.get("OTP_HMAC_SECRET");if(!secret)throw Object.assign(new Error("OTP service is not configured."),{status:503});
        const codeHash=await hmac(secret,email+":"+purpose+":"+code);
        await sendResendEmail(email,code,purpose);
        const {error}=await service.from("realx_otp_challenges").insert({email,purpose,code_hash:codeHash,expires_at:new Date(Date.now()+5*60_000).toISOString()});
        if(error)throw error;return reply({success:true,expiresIn:300});
      }
      case "verifyOtp": {
        const email=normalizeEmail(data.email),purpose=String(data.purpose||""),code=normalizeDigits(data.code);
        if(!isEmail(email)||!["signup","login","verification"].includes(purpose)||!/^\d{6}$/.test(code))throw Object.assign(new Error("Invalid verification code"),{status:400});
        if(purpose!=="verification"){
          const {data:verified,error}=await client.auth.verifyOtp({email,token:code,type:"email"});
          if(error)throw error;
          if(!verified.session)throw Object.assign(new Error("The sign-in session was not created"),{status:401});
          return reply({success:true,verified:true,accessToken:verified.session.access_token,refreshToken:verified.session.refresh_token,userId:verified.user?.id});
        }
        const secret=Deno.env.get("OTP_HMAC_SECRET");if(!secret)throw Object.assign(new Error("OTP service is not configured."),{status:503});
        const {data:challenge,error}=await service.from("realx_otp_challenges").select("*").eq("email",email).eq("purpose",purpose).is("verified_at",null).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(error)throw error;if(!challenge||challenge.attempts>=3)throw Object.assign(new Error("Code expired or invalid"),{status:400});
        const expected=await hmac(secret,email+":"+purpose+":"+code);
        if(expected!==challenge.code_hash){await service.from("realx_otp_challenges").update({attempts:challenge.attempts+1}).eq("id",challenge.id);throw Object.assign(new Error("Code expired or invalid"),{status:400});}
        await service.from("realx_otp_challenges").update({verified_at:new Date().toISOString()}).eq("id",challenge.id);
        return reply({success:true,verified:true});
      }
      case "completeSignup": {
        requireUser();const {data:result,error}=await client.rpc("realx_complete_signup",{p_profile:data});
        if(error)throw error;return reply(result);
      }
      case "assignCreatorCode": {
        requireUser();const {data:code,error}=await client.rpc("realx_assign_creator_code");
        if(error)throw error;return reply({creatorCode:code});
      }
      case "submitVerificationRequest": {
        const email=normalizeEmail(data.email),role=["student","creator"].includes(data.role)?data.role:"student";
        if(!isEmail(email))throw Object.assign(new Error("Valid email required"),{status:400});
        if(await allowedSchoolEmail(service,email))throw Object.assign(new Error("Please use regular signup with your school email"),{status:400});
        await incrementRateLimit(service,await sha256("verification-submit:"+email),3,3600);
        if(await existsStudent(service,email))throw Object.assign(new Error("An account with this email already exists"),{status:409});
        const {data:pending,error:pendingError}=await service.from("realx_verification_requests").select("id").eq("email",email).eq("status","pending").limit(1);
        if(pendingError)throw pendingError;if(pending?.length)throw Object.assign(new Error("You already have a pending verification request"),{status:409});
        const {data:verified,error:otpError}=await service.from("realx_otp_challenges").select("id").eq("email",email).eq("purpose","verification").not("verified_at","is",null).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(otpError)throw otpError;if(!verified)throw Object.assign(new Error("A verified email code is required"),{status:403});
        let path:string|null=null;
        if(data.idImageBase64){
          const bytes=base64ToBytes(String(data.idImageBase64));if(bytes.byteLength>3*1024*1024)throw Object.assign(new Error("ID image is too large"),{status:413});
          const ext=String(data.imageExtension||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase()||"jpg";
          const objectPath=await sha256(email)+"/"+crypto.randomUUID()+"."+ext;
          path="realx-student-documents/"+objectPath;
          const {error:uploadError}=await service.storage.from("realx-student-documents").upload(objectPath,bytes,{contentType:String(data.contentType||"image/jpeg"),upsert:false});
          if(uploadError)throw uploadError;
        }
        const statusToken=randomToken();
        const {data:requestId,error}=await service.rpc("realx_submit_verification_request",{p_email:email,p_role:role,p_status_token:statusToken,p_image_path:path,p_details:data.details||{}});
        if(error){if(path)await service.storage.from("realx-student-documents").remove([path.replace(/^realx-student-documents\//,"")]);throw error;}
        return reply({success:true,requestId,statusToken});
      }
      case "checkVerificationStatus": {
        const {data:status,error}=await client.rpc("realx_get_verification_status",{p_request_id:data.requestId,p_status_token:data.statusToken});
        if(error)throw error;return reply(status);
      }
      case "cancelVerificationRequest": {
        const {error}=await client.rpc("realx_cancel_verification_request",{p_request_id:data.requestId,p_status_token:data.statusToken});
        if(error)throw error;return reply({success:true});
      }
      case "reviewVerificationRequest": {
        const current=await requireAdmin();const decision=data.decision==="approved"?"approved":"rejected";
        const {data:result,error}=await client.rpc("realx_review_verification_request",{p_request_id:data.requestId,p_decision:decision,p_reason:data.reason||null});
        if(error)throw error;return reply({...result,reviewedBy:current.id});
      }
      case "getOpportunityAction": {
        requireUser();
        const {data:result,error}=await client.rpc("realx_get_opportunity_action",{p_opportunity_id:data.opportunityId,p_request_id:data.requestId});
        if(error)throw error;return reply(result);
      }
      case "trackOpportunityEvent": {
        requireUser();
        const {error}=await client.rpc("realx_track_opportunity_event",{p_opportunity_id:data.opportunityId,p_event:data.event,p_payload:data.payload||{}});
        if(error)throw error;return reply({success:true});
      }
      case "setVendorRedemptionPin": {
        requireUser();
        const {error}=await client.rpc("realx_set_vendor_redemption_pin",{p_vendor_id:data.vendorId,p_pin:normalizeDigits(data.pin)});
        if(error)throw error;return reply({success:true});
      }
      case "redeemOffer":
      case "redeemGiftCard": {
        const current=requireUser();
        const vendorId=String(data.vendorId||"");const total=Number(data.totalAmount||0);
        if(!vendorId||!Number.isFinite(total)||total<=0||total>1_000_000)throw Object.assign(new Error("Redemption details are invalid"),{status:400});
        const {data:result,error}=await client.rpc("realx_redeem_offer",{
          p_vendor_id:vendorId,p_offer_id:data.offerId||null,p_total_amount:total,p_pin:normalizeDigits(data.pin),
          p_type:action==="redeemGiftCard"?"giftcard":"offer",p_giftcard_amount:Number(data.giftCardAmount||0),
          p_offer_index:data.offerIndex??null,p_creator_code:data.creatorCode||null,p_idempotency_key:data.idempotencyKey||crypto.randomUUID(),
        });
        if(error)throw error;
        if(result?.creatorUid&&Number(result.creatorCashback)>0){
          try{await sendExpoPushToUser(service,String(result.creatorUid),{title:"Your code was used!",body:`Someone used your code at ${result.vendorName||"a vendor"}. You earned ${Number(result.creatorCashback).toFixed(2)} XPoints.`,data:{type:"creator_code_used",transactionId:result.transactionId,vendorName:result.vendorName,cashbackAmount:result.creatorCashback},channelId:"reelx_general"});}catch(pushError){console.warn("creator reward push failed",String((pushError as any)?.message||pushError));}
        }
        return reply(result);
      }
      case "claimBadrgoVoucher": {
        const current=requireUser();
        const {data:result,error}=await client.rpc("realx_claim_badrgo_voucher");
        if(error)throw error;
        if(result?.success&&!result?.existing){
          try{await sendExpoPushToUser(service,current.id,{title:"Your Badrgo ride code is ready",body:"Your student ride voucher is ready to use.",data:{type:"badrgo_voucher_claimed",claimId:result.id,programId:"badrgo-rides"}});}catch(pushError){console.warn("Badrgo claim push failed",String((pushError as any)?.message||pushError));}
        }
        return reply(result);
      }
      case "getBadrgoPilotCampaign": {
        const {data:result,error}=await client.rpc("realx_get_badrgo_pilot_campaign");
        if(error)throw error;return reply(result);
      }
      case "claimBadrgoPilotCoupon": {
        const current=requireUser();
        const {data:result,error}=await client.rpc("realx_claim_badrgo_pilot_coupon");
        if(error)throw error;
        if(result&&!result.existing){
          try{await sendExpoPushToUser(service,current.id,{title:"Your Badrgo ride is ready",body:"Open RealX to view and copy your personal ride code.",data:{type:"pilot_coupon_claimed",campaignId:"badrgo-first-ride-2026",path:"/pilot/badrgo"},channelId:"reelx_general"});}
          catch(pushError){console.warn("Badrgo pilot claim push failed",String((pushError as any)?.message||pushError));}
        }
        return reply({...result,success:true,alreadyClaimed:Boolean(result?.existing)});
      }
      case "getOnlineVendorOffer":
      case "getOnlineRedemptionPreview": {
        const current=requireUser();const vendorId=String(data.vendorId||"");
        if(!vendorId||vendorId.length>200)throw Object.assign(new Error("A valid vendor ID is required"),{status:400});
        return reply({vendorId,...await getEligibleOnlineVendor(service,current.id,vendorId)});
      }
      case "recordOnlineVendorOutboundClick":
      case "redeemOnlineVendor": {
        const current=requireUser();const vendorId=String(data.vendorId||"");
        if(!vendorId||vendorId.length>200)throw Object.assign(new Error("A valid vendor ID is required"),{status:400});
        const offer=await getEligibleOnlineVendor(service,current.id,vendorId);
        const {data:click,error}=await client.rpc("realx_record_online_click",{p_vendor_id:vendorId,p_request_id:data.requestId||crypto.randomUUID(),p_platform:data.platform||"web"});
        if(error)throw error;
        if(action==="recordOnlineVendorOutboundClick")return reply(click);
        return reply({...click,...offer,url:click?.purchaseUrl||offer.purchaseUrl});
      }
      case "registerPushToken": {
        const current=requireUser();const token=String(data.token||"");if(!/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token))throw Object.assign(new Error("A valid Expo push token is required"),{status:400});
        const {error}=await client.from("realx_push_tokens").upsert({user_id:current.id,token,platform:data.platform||null},{onConflict:"token"});
        if(error)throw error;return reply({success:true});
      }
      case "unregisterPushToken": {
        const current=requireUser();const token=String(data.token||"");if(!/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token))throw Object.assign(new Error("A valid Expo push token is required"),{status:400});
        const {error}=await client.from("realx_push_tokens").delete().eq("user_id",current.id).eq("token",token);
        if(error)throw error;return reply({success:true});
      }
      default:
        throw Object.assign(new Error("Unknown mobile action: "+action),{status:404});
    }
  }catch(error){console.error("realx-mobile-action",String((error as any)?.message||error));return errorReply(error);}
});

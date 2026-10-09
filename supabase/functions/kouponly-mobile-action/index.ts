import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const errorReply=(error:any)=>reply({error:error?.message||"Request failed",code:error?.code},Number(error?.status||400));
const sha256=async(value:string)=>{const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");};
const hmac=async(secret:string,value:string)=>{const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));return [...bytes].map(v=>v.toString(16).padStart(2,"0")).join("");};
const randomCode=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,"0");
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
const base64ToBytes=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const normalizeEmail=(value:unknown)=>String(value||"").trim().toLowerCase();
const isEmail=(value:string)=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
const isSchoolEmail=(email:string)=>/^[^@\s]+@rajagiri\.edu\.in$/.test(email);
const normalizeDigits=(value:any)=>String(value??"").replace(/[٠-٩۰-۹]/g,(digit)=>{const arabic="٠١٢٣٤٥٦٧٨٩",persian="۰۱۲۳۴۵۶۷۸۹";const i=arabic.indexOf(digit);return String(i>-1?i:persian.indexOf(digit));});
const asRows=(response:any)=>response.data||[];
async function existsStudent(service:any,email:string){const {data,error}=await service.from("couponly_students").select("id").eq("email",email).limit(1);if(error)throw error;return Boolean(data?.length);}
async function roleOf(client:any,uid:string){const {data,error}=await client.from("couponly_user_roles").select("role").eq("user_id",uid).maybeSingle();if(error)throw error;return data?.role||null;}
async function incrementRateLimit(service:any,key:string,limit:number,windowSeconds:number){
  const {data,error}=await service.rpc("couponly_increment_rate_limit",{p_key:key,p_limit:limit,p_window_seconds:windowSeconds});
  if(error)throw error;if(!data)throw Object.assign(new Error("Too many requests. Please try again later."),{status:429});
}
async function sendExpoPushToUser(service:any,uid:string,message:Record<string,unknown>){
  const {data:rows,error}=await service.from("couponly_push_tokens").select("token").eq("user_id",uid);
  if(error)throw error;
  const tokens=(rows||[]).map((row:any)=>String(row.token||"")).filter((token:string)=>/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token));
  const invalid:string[]=[];
  for(let offset=0;offset<tokens.length;offset+=100){
    const chunk=tokens.slice(offset,offset+100);
    const result=await fetch("https://exp.host/--/api/v2/push/send",{method:"POST",headers:{Accept:"application/json","Accept-Encoding":"gzip, deflate","Content-Type":"application/json"},body:JSON.stringify(chunk.map((to:string)=>({to,...message})))});
    if(!result.ok)throw new Error("Push notification delivery failed");
    const payload=await result.json();
    (payload.data||[]).forEach((ticket:any,index:number)=>{if(ticket.status==="error"&&["DeviceNotRegistered","InvalidCredentials"].includes(ticket.details?.error||""))invalid.push(chunk[index]);});
  }
  if(invalid.length)await service.from("couponly_push_tokens").delete().in("token",invalid);
}
async function sendResendEmail(email:string,code:string,purpose:string){
  const apiKey=Deno.env.get("RESEND_API_KEY");if(!apiKey)throw Object.assign(new Error("Email delivery is not configured for verification codes."),{status:503});
  const from=Deno.env.get("RESEND_FROM_EMAIL")||"Kouponly <verification@kouponly.com>";
  const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:purpose==="verification"?"Verify your email":"Your Kouponly sign in code",text:"Your verification code is "+code+". It expires in five minutes."})});
  if(!result.ok){console.error("Resend email delivery failed with status",result.status);throw Object.assign(new Error(`Could not send the verification email (provider status ${result.status}).`),{status:502});}
}
Deno.serve(async(request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="POST")return reply({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL");const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!serviceKey)return reply({error:"Supabase server configuration is incomplete"},500);
  const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const input=await request.json();const action=String(input.action||"");const data=input.data||{};
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
        return reply({exists:await existsStudent(service,email)});
      }
      case "sendOtp": {
        const email=normalizeEmail(data.email),purpose=String(data.purpose||"");
        if(!isEmail(email)||!["signup","login","verification"].includes(purpose))throw Object.assign(new Error("A valid email and OTP purpose are required"),{status:400});
        const ip=request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
        if(purpose!=="login"&&!isSchoolEmail(email))throw Object.assign(new Error("Use your @rajagiri.edu.in email address"),{status:403});
        await incrementRateLimit(service,await sha256("send:"+email+":"+purpose+":"+ip),5,900);
        if(purpose!=="login"&&await existsStudent(service,email))throw Object.assign(new Error("An account with this email already exists"),{status:409});
        if(purpose==="login"&&!await existsStudent(service,email)){
          const {data:approved,error}=await service.from("couponly_verification_requests").select("id").eq("email",email).eq("status","approved").limit(1);
          if(error)throw error;if(!approved?.length)throw Object.assign(new Error("No account found with this email"),{status:404});
        }
        if(purpose!=="verification"){
          const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:purpose==="signup"}});
          if(error)throw error;
          return reply({success:true,expiresIn:300});
        }
        const {data:latest,error:latestError}=await service.from("couponly_otp_challenges").select("created_at").eq("email",email).eq("purpose",purpose).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(latestError)throw latestError;
        if(latest?.created_at&&Date.now()-new Date(latest.created_at).getTime()<60_000)throw Object.assign(new Error("Please wait before requesting another code."),{status:429});
        const code=randomCode(),secret=Deno.env.get("OTP_HMAC_SECRET");if(!secret)throw Object.assign(new Error("OTP service is not configured."),{status:503});
        const codeHash=await hmac(secret,email+":"+purpose+":"+code);
        await sendResendEmail(email,code,purpose);
        const {error}=await service.from("couponly_otp_challenges").insert({email,purpose,code_hash:codeHash,expires_at:new Date(Date.now()+5*60_000).toISOString()});
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
        const {data:challenge,error}=await service.from("couponly_otp_challenges").select("*").eq("email",email).eq("purpose",purpose).is("verified_at",null).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(error)throw error;if(!challenge||challenge.attempts>=3)throw Object.assign(new Error("Code expired or invalid"),{status:400});
        const expected=await hmac(secret,email+":"+purpose+":"+code);
        if(expected!==challenge.code_hash){await service.from("couponly_otp_challenges").update({attempts:challenge.attempts+1}).eq("id",challenge.id);throw Object.assign(new Error("Code expired or invalid"),{status:400});}
        await service.from("couponly_otp_challenges").update({verified_at:new Date().toISOString()}).eq("id",challenge.id);
        return reply({success:true,verified:true});
      }
      case "completeSignup": {
        requireUser();const {data:result,error}=await client.rpc("couponly_complete_signup",{p_profile:{...data,accountRole:"student"}});
        if(error)throw error;return reply(result);
      }
      case "assignCreatorCode": {
        requireUser();const {data:code,error}=await client.rpc("couponly_assign_creator_code");
        if(error)throw error;return reply({creatorCode:code});
      }
      case "submitVerificationRequest": {
        const email=normalizeEmail(data.email),role="student";
        if(!isSchoolEmail(email))throw Object.assign(new Error("Use your @rajagiri.edu.in email address"),{status:403});
        await incrementRateLimit(service,await sha256("verification-submit:"+email),3,3600);
        if(await existsStudent(service,email))throw Object.assign(new Error("An account with this email already exists"),{status:409});
        const {data:pending,error:pendingError}=await service.from("couponly_verification_requests").select("id").eq("email",email).eq("status","pending").limit(1);
        if(pendingError)throw pendingError;if(pending?.length)throw Object.assign(new Error("You already have a pending verification request"),{status:409});
        const {data:verified,error:otpError}=await service.from("couponly_otp_challenges").select("id").eq("email",email).eq("purpose","verification").not("verified_at","is",null).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();
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
        const {data:requestId,error}=await service.rpc("couponly_submit_verification_request",{p_email:email,p_role:role,p_status_token:statusToken,p_image_path:path,p_details:data.details||{}});
        if(error){if(path)await service.storage.from("realx-student-documents").remove([path.replace(/^realx-student-documents\//,"")]);throw error;}
        return reply({success:true,requestId,statusToken});
      }
      case "checkVerificationStatus": {
        const {data:status,error}=await client.rpc("couponly_get_verification_status",{p_request_id:data.requestId,p_status_token:data.statusToken});
        if(error)throw error;return reply(status);
      }
      case "cancelVerificationRequest": {
        const {error}=await client.rpc("couponly_cancel_verification_request",{p_request_id:data.requestId,p_status_token:data.statusToken});
        if(error)throw error;return reply({success:true});
      }
      case "reviewVerificationRequest": {
        const current=await requireAdmin();const decision=data.decision==="approved"?"approved":"rejected";
        const {data:result,error}=await client.rpc("couponly_review_verification_request",{p_request_id:data.requestId,p_decision:decision,p_reason:data.reason||null});
        if(error)throw error;return reply({...result,reviewedBy:current.id});
      }
      case "getOpportunityAction": {
        requireUser();
        const {data:result,error}=await client.rpc("couponly_get_opportunity_action",{p_opportunity_id:data.opportunityId,p_request_id:data.requestId});
        if(error)throw error;return reply(result);
      }
      case "trackOpportunityEvent": {
        requireUser();
        const {error}=await client.rpc("couponly_track_opportunity_event",{p_opportunity_id:data.opportunityId,p_event:data.event,p_payload:data.payload||{}});
        if(error)throw error;return reply({success:true});
      }
      case "redeemOffer": {
        const current=requireUser();
        const vendorId=String(data.vendorId||"");const total=Number(data.totalAmount||0);
        if(!vendorId||!Number.isFinite(total)||total<=0||total>1_000_000)throw Object.assign(new Error("Redemption details are invalid"),{status:400});
        const {data:result,error}=await client.rpc("couponly_redeem_offer",{
          p_vendor_id:vendorId,p_offer_id:data.offerId||null,p_total_amount:total,
          p_type:"offer",p_giftcard_amount:0,
          p_offer_index:data.offerIndex??null,p_creator_code:data.creatorCode||null,p_idempotency_key:data.idempotencyKey||crypto.randomUUID(),
        });
        if(error)throw error;
        if(result?.creatorUid&&Number(result.creatorCashback)>0){
          try{await sendExpoPushToUser(service,String(result.creatorUid),{title:"Your code was used!",body:`Someone used your code at ${result.vendorName||"a vendor"}. You earned ${Number(result.creatorCashback).toFixed(2)} XPoints.`,data:{type:"creator_code_used",transactionId:result.transactionId,vendorName:result.vendorName,cashbackAmount:result.creatorCashback},channelId:"reelx_general_v2"});}catch(pushError){console.warn("creator reward push failed",String((pushError as any)?.message||pushError));}
        }
        return reply(result);
      }
      case "registerPushToken": {
        const current=requireUser();const token=String(data.token||"");if(!/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token))throw Object.assign(new Error("A valid Expo push token is required"),{status:400});
        const {error}=await client.from("couponly_push_tokens").upsert({user_id:current.id,token,platform:data.platform||null},{onConflict:"token"});
        if(error)throw error;return reply({success:true});
      }
      case "unregisterPushToken": {
        const current=requireUser();const token=String(data.token||"");if(!/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token))throw Object.assign(new Error("A valid Expo push token is required"),{status:400});
        const {error}=await client.from("couponly_push_tokens").delete().eq("user_id",current.id).eq("token",token);
        if(error)throw error;return reply({success:true});
      }
      default:
        throw Object.assign(new Error("Unknown mobile action: "+action),{status:404});
    }
  }catch(error){console.error("coop-mobile-action",String((error as any)?.message||error));return errorReply(error);}
});

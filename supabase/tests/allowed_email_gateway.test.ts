// Exercise the real gateway handler without sending email or making network requests.
Deno.test('signup/login/verification enforce the live domain policy before OTP delivery', async () => {
  const originalServe=Deno.serve, originalFetch=globalThis.fetch, originalInterval=globalThis.setInterval;
  const timers:ReturnType<typeof setInterval>[]=[];
  globalThis.setInterval=((...args:Parameters<typeof setInterval>)=>{ const timer=originalInterval(...args);timers.push(timer);return timer; }) as typeof setInterval;
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
  const originalEnv=keys.map(key=>Deno.env.get(key));
  let handler:(request:Request)=>Promise<Response>;
  let allowed=false, policyFailure=false;
  const calls:string[]=[];
  try {
    Deno.env.set(keys[0],'https://policy-test.invalid');
    Deno.env.set(keys[1],'test-anon-key'); Deno.env.set(keys[2],'test-service-key');
    (Deno as any).serve=(callback:typeof handler)=>{handler=callback;return {};};
    globalThis.fetch=async(input,init)=>{
      const request=new Request(input,init),path=new URL(request.url).pathname;
      calls.push(path);
      if(path==='/rest/v1/rpc/kouponly_school_email') {
        const body=await request.json();
        if(!body.p_email)throw Error('Missing email policy argument');
        return new Response(JSON.stringify(policyFailure?{message:'Policy unavailable'}:allowed),{status:policyFailure?503:200,headers:{'Content-Type':'application/json'}});
      }
      if(path==='/rest/v1/rpc/couponly_increment_rate_limit')return Response.json(true);
      if(path==='/rest/v1/couponly_students')return Response.json([]);
      if(path==='/auth/v1/otp')return Response.json({});
      throw Error('Unexpected network request: '+path);
    };
    await import('../functions/kouponly-mobile-action/index.ts');
    for(const purpose of ['signup','login','verification']) {
      calls.length=0;
      const response=await handler!(new Request('https://gateway.invalid',{method:'POST',body:JSON.stringify({action:'sendOtp',data:{email:'student@gmail.com',purpose}})}));
      if(response.status!==403 || calls.length!==1)throw Error('Unapproved '+purpose+' was not rejected before delivery');
    }
    const rejectedVerification=await handler!(new Request('https://gateway.invalid',{method:'POST',body:JSON.stringify({action:'verifyOtp',data:{email:'student@gmail.com',purpose:'login',code:'123456'}})}));
    if(rejectedVerification.status!==403)throw Error('Old OTP bypassed a disabled domain');
    allowed=true;
    const accepted=await handler!(new Request('https://gateway.invalid',{method:'POST',body:JSON.stringify({action:'checkStudentExists',data:{email:'student@newcollege.edu'}})}));
    if(accepted.status!==200)throw Error('Additional enabled domain was rejected');
    policyFailure=true; calls.length=0;
    const unavailable=await handler!(new Request('https://gateway.invalid',{method:'POST',body:JSON.stringify({action:'sendOtp',data:{email:'student@rajagiri.edu.in',purpose:'signup'}})}));
    if(unavailable.status<400 || calls.length!==1)throw Error('Policy outage did not fail closed');
  } finally {
    timers.forEach(timer=>clearInterval(timer));globalThis.setInterval=originalInterval;
    Deno.serve=originalServe;globalThis.fetch=originalFetch;
    keys.forEach((key,i)=>originalEnv[i]===undefined?Deno.env.delete(key):Deno.env.set(key,originalEnv[i]!));
  }
});

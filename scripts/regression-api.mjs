const BASE = process.env.BLINDMATCH_API_URL || 'http://localhost:4000';
let pass=0, fail=0;
function report(name, ok, detail=''){ console.log(`${ok?'PASS':'FAIL'}  ${name}${detail?' — '+detail:''}`); ok?pass++:fail++; }
async function json(url, options={}){
  const r=await fetch(BASE+url,options); const body=await r.json().catch(()=>({})); return {r,body};
}
async function login(email,password,role){
  const {r,body}=await json('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  report(`${role} login`,r.ok && body.user?.role===role,r.ok?'':body.error); return body.token;
}

try{
  const health=await json('/api/health'); report('API health',health.r.ok && health.body.ok===true);
  const admin=await login('admin@blindmatch.local','Admin@123','ADMIN');
  const hospital=await login('hospital@blindmatch.local','Hospital@123','HOSPITAL');
  const researcher=await login('researcher@blindmatch.local','Research@123','RESEARCHER');

  if(admin){
    const x=await json('/api/admin/summary',{headers:{Authorization:`Bearer ${admin}`}});
    report('Admin summary',x.r.ok);
  }

  let credentialId, handoffCode;
  if(hospital){
    const x=await json('/api/hospital/credentials',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${hospital}`},body:JSON.stringify({patientReference:'REGRESSION-PATIENT',patientName:'Regression Patient',age:36,biomarker:110,diagnosisCode:103,validityDays:7})});
    credentialId=x.body?.credentialSubject?.credentialId; handoffCode=x.body?.handoffCode;
    report('Hospital credential issuance',x.r.status===201 && !!credentialId && !!handoffCode,x.body?.error);
  }

  if(handoffCode){
    const token=handoffCode.replace(/^blindmatch-claim:/,'');
    const x=await json(`/api/hospital/handoffs/${encodeURIComponent(token)}/claim`,{method:'POST'});
    report('One-time credential claim',x.r.ok && x.body?.credentialSubject?.credentialId===credentialId,x.body?.error);
    const y=await json(`/api/hospital/handoffs/${encodeURIComponent(token)}/claim`,{method:'POST'});
    report('Claim cannot be reused',y.r.status===404);
  }

  if(credentialId){
    const x=await json(`/api/credentials/${encodeURIComponent(credentialId)}/status`);
    report('Credential registry status',x.r.ok && x.body?.status==='ACTIVE');
  }

  if(researcher){
    const stamp=Date.now();
    const x=await json('/api/trials',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${researcher}`},body:JSON.stringify({title:`Regression Trial ${stamp}`,sponsor:'BlindMatch Regression',minAge:30,maxAge:50,minBiomarker:100,maxBiomarker:130,requiredDiagnosis:103})});
    report('Researcher trial creation',x.r.status===201 && !!x.body?.id,x.body?.error);
    const m=await json('/api/matches',{headers:{Authorization:`Bearer ${researcher}`}});
    report('Researcher anonymous-match access',m.r.ok && Array.isArray(m.body),m.body?.error);
  }
} catch(e){ report('Regression script execution',false,e.message); }
console.log(`\n${pass} passed, ${fail} failed.`);
if(fail) process.exit(1);

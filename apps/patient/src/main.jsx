import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Wallet,keccak256,toUtf8Bytes,verifyMessage} from 'ethers';
import {groth16} from 'snarkjs';
import {Html5Qrcode} from 'html5-qrcode';
import {encryptJson,decryptJson} from './crypto.js';
import './styles.css';

const API=import.meta.env.VITE_API_URL||'';
const ZK_ENABLED=String(import.meta.env.VITE_ZK_ENABLED||'false')==='true';
const STORE='blindmatch.encryptedCredential';

function canonical(s){return JSON.stringify({credentialId:String(s.credentialId),patientReference:String(s.patientReference||''),patientName:String(s.patientName||''),age:Number(s.age),biomarker:Number(s.biomarker),diagnosisCode:Number(s.diagnosisCode),salt:String(s.salt)});}
function eligible(s,t){return s.age>=t.minAge&&s.age<=t.maxAge&&s.biomarker>=t.minBiomarker&&s.biomarker<=t.maxBiomarker&&s.diagnosisCode===t.requiredDiagnosis;}
function decodeTransfer(text){
  const raw=text.trim(); if(raw.startsWith('{'))return JSON.parse(raw);
  if(!raw.startsWith('blindmatch-vc:'))throw new Error('Not a BlindMatch credential code.');
  let b64=raw.slice('blindmatch-vc:'.length).replaceAll('-','+').replaceAll('_','/'); while(b64.length%4)b64+='=';
  const binary=atob(b64);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));
}

async function resolveTransfer(text){
  const raw=text.trim();
  if(raw.startsWith('blindmatch-claim:')){
    const token=raw.slice('blindmatch-claim:'.length);
    if(!token) throw new Error('Invalid QR handoff token.');
    const r=await fetch(`${API}/api/hospital/handoffs/${encodeURIComponent(token)}/claim`,{method:'POST'});
    const vc=await r.json();
    if(!r.ok) throw new Error(vc.error||'Could not claim hospital credential.');
    return vc;
  }
  return decodeTransfer(raw);
}

function App(){
 const[trials,setTrials]=useState([]),[trialId,setTrialId]=useState(''),[credential,setCredential]=useState(null),[pin,setPin]=useState('1234'),[status,setStatus]=useState(''),[proofBundle,setProofBundle]=useState(null),[importText,setImportText]=useState(''),[scanning,setScanning]=useState(false);
 const scannerRef=useRef(null);
 useEffect(()=>{fetch(`${API}/api/trials`).then(r=>r.json()).then(x=>{setTrials(x);if(x[0])setTrialId(String(x[0].id));}).catch(e=>setStatus(e.message));return()=>{void stopScan();};},[]);
 const trial=trials.find(t=>String(t.id)===String(trialId));

 async function verifyAndLoad(vc){
   if(!vc?.credentialSubject||!vc?.proof)throw new Error('Invalid credential format.');
   const recovered=verifyMessage(vc.proof.payloadHash,vc.proof.signature);
   const calculated=keccak256(toUtf8Bytes(canonical(vc.credentialSubject)));
   if(recovered.toLowerCase()!==vc.proof.verificationMethod.toLowerCase()||calculated!==vc.proof.payloadHash)throw new Error('Hospital credential signature validation failed.');
   if(vc.validUntil&&new Date(vc.validUntil).getTime()<=Date.now())throw new Error('Hospital credential has expired.');
   const id=vc.credentialSubject.credentialId;
   let resolvedVc=vc;
   if(id){
     const r=await fetch(`${API}/api/credentials/${encodeURIComponent(id)}/status`);
     const x=await r.json();
     if(!r.ok)throw new Error(x.error||'Credential status could not be verified.');
     if(x.status!=='ACTIVE')throw new Error(`Credential status is ${x.status}.`);
     if(vc.issuerOrganizationId&&x.issuerOrganizationId&&String(vc.issuerOrganizationId)!==String(x.issuerOrganizationId))throw new Error('Credential issuer organization does not match the registry.');
     if(vc.issuerName&&x.issuerName&&String(vc.issuerName)!==String(x.issuerName))throw new Error('Credential issuer name does not match the registry.');
     resolvedVc={...vc,issuerName:x.issuerName||vc.issuerName||'Unknown hospital',issuerOrganizationId:x.issuerOrganizationId||vc.issuerOrganizationId||null,issuerHospitalId:x.issuerHospitalId||vc.issuerHospitalId||null};
   }
   setCredential(resolvedVc);setProofBundle(null);setStatus(`Hospital signature and status verified. Credential ${id||''} loaded locally.`);
 }
 async function loadDemo(){
   try{const subject={age:42,biomarker:110,diagnosisCode:101};const r=await fetch(`${API}/api/issuer/demo-credential`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subject)}); const vc=await r.json();if(!r.ok)throw new Error(vc.error||'Credential issue failed');await verifyAndLoad(vc);}catch(e){setStatus(e.message)}
 }
 async function importCredential(){try{await verifyAndLoad(await resolveTransfer(importText));setImportText('');}catch(e){setStatus(`Import failed: ${e.message}`)}}
 async function save(){if(!credential)return setStatus('Load a credential first.');localStorage.setItem(STORE,JSON.stringify(await encryptJson(credential,pin)));setCredential(null);setStatus('Credential encrypted locally. Raw fields were not sent to the research portal or blockchain.');}
 async function unlock(){try{const b=JSON.parse(localStorage.getItem(STORE)||'null');if(!b)return setStatus('No saved credential.');const vc=await decryptJson(b,pin);await verifyAndLoad(vc);}catch(e){setStatus(`Could not unlock credential: ${e.message}`);}}

 async function stopScan(){
   const scanner=scannerRef.current;
   scannerRef.current=null;
   if(scanner){
     try{if(scanner.isScanning)await scanner.stop();}catch{}
     try{scanner.clear();}catch{}
   }
   setScanning(false);
 }
 async function startScan(){
   if(!window.isSecureContext){
     return setStatus('Camera scanning needs HTTPS on mobile. Open the Patient Wallet through your HTTPS tunnel, then try again.');
   }
   if(!navigator.mediaDevices?.getUserMedia){
     return setStatus('Camera access is unavailable in this browser. Paste the transfer code or import JSON instead.');
   }
   await stopScan();
   setScanning(true);
   setStatus('Starting camera… Allow camera permission when Chrome asks.');
   await new Promise(resolve=>setTimeout(resolve,50));
   try{
     const scanner=new Html5Qrcode('blindmatch-qr-reader', false);
     scannerRef.current=scanner;
     await scanner.start(
       {facingMode:'environment'},
       {fps:10,qrbox:{width:240,height:240},aspectRatio:1},
       async(decodedText)=>{
         try{
           setStatus('QR detected. Claiming signed hospital credential…');
           const vc=await resolveTransfer(decodedText);
           await stopScan();
           await verifyAndLoad(vc);
           setStatus('Hospital QR scanned. Credential signature and status verified.');
         }catch(e){
           await stopScan();
           setStatus(`QR read, but credential import failed: ${e.message}`);
         }
       },
       ()=>{}
     );
     setStatus('Camera ready. Point it at the Hospital Portal QR code.');
   }catch(e){
     await stopScan();
     const name=e?.name||'';
     const msg=String(e?.message||e||'Unknown camera error');
     if(name==='NotAllowedError'||/permission|denied/i.test(msg))setStatus('Camera permission was denied. In Chrome, allow Camera for this HTTPS site and try again.');
     else if(name==='NotFoundError'||/not found|no camera/i.test(msg))setStatus('No usable camera was found on this device.');
     else setStatus(`Camera scan failed: ${msg}`);
   }
 }

 async function prove(){
  if(!credential||!trial)return setStatus('Unlock/import a credential and choose a trial.');
  try{await verifyAndLoad(credential);}catch(e){return setStatus(e.message)}
  const s=credential.credentialSubject;
  if(!eligible(s,trial)){setProofBundle(null);return setStatus('Not eligible for this trial. No proof submitted.');}
  const ephemeral=Wallet.createRandom().address;
  if(ZK_ENABLED){
    setStatus('Generating zero-knowledge proof locally…');
    try{
      const input={age:s.age,biomarker:s.biomarker,diagnosisCode:s.diagnosisCode,salt:s.salt,minAge:trial.minAge,maxAge:trial.maxAge,minBiomarker:trial.minBiomarker,maxBiomarker:trial.maxBiomarker,requiredDiagnosis:trial.requiredDiagnosis,trialId:trial.id};
      const {proof,publicSignals}=await groth16.fullProve(input,'/zk/eligibility.wasm','/zk/eligibility_final.zkey');
      setProofBundle({trialId:trial.id,credentialId:s.credentialId,ephemeralPatient:ephemeral,proof,publicSignals,mode:'zk'}); setStatus('Real Groth16 proof generated locally. Raw clinical inputs stayed in this browser.');
    }catch(e){setStatus(`ZK generation failed: ${e.message}`);}
  }else{
    const commitment=BigInt('0x'+[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('')).toString();
    setProofBundle({trialId:trial.id,credentialId:s.credentialId,ephemeralPatient:ephemeral,proof:{demo:true},publicSignals:[commitment,String(trial.minAge),String(trial.maxAge),String(trial.minBiomarker),String(trial.maxBiomarker),String(trial.requiredDiagnosis),String(trial.id)],mode:'demo'});
    setStatus('Eligible. Demo proof envelope created locally. Enable VITE_ZK_ENABLED=true for cryptographic verification.');
  }
 }
 async function submit(){if(!proofBundle)return setStatus('Generate a proof first.');const r=await fetch(`${API}/api/matches/verify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(proofBundle)});const x=await r.json();setStatus(r.ok?`Anonymous match accepted: ${String(x.matchId).slice(0,24)}…`:x.error||'Submission failed');}

 return <main className="shell"><header className="hero"><span className="eyebrow">BlindMatch 2.0</span><h1>Patient Privacy Wallet</h1><p>Receive a hospital-signed clinical credential, keep it encrypted on your device, and prove trial eligibility without exposing the clinical fields.</p><span className={'badge '+(ZK_ENABLED?'secure':'demo')}>{ZK_ENABLED?'Real ZK mode':'Demo mode'}</span></header>
 <section className="grid"><div className="card"><h2>1. Hospital credential</h2><p className="muted">Scan the QR displayed by the Hospital Portal, paste its transfer code, import its JSON, or use the synthetic demo credential.</p><div className="actions"><button onClick={startScan}>Scan hospital QR</button><button onClick={loadDemo}>Load demo credential</button></div>
 {scanning&&<div className="scanner"><div id="blindmatch-qr-reader"/><p className="scannerHelp">Use the rear camera and keep the full hospital QR inside the square.</p><button onClick={()=>void stopScan()}>Stop camera</button></div>}
 <label>Transfer code / credential JSON<textarea rows="4" value={importText} onChange={e=>setImportText(e.target.value)} placeholder="blindmatch-vc:… or paste credential JSON"/></label><button onClick={importCredential}>Verify & import</button>
 <label>Local wallet PIN<input type="password" value={pin} onChange={e=>setPin(e.target.value)}/></label><div className="actions"><button onClick={save}>Encrypt & save</button><button onClick={unlock}>Unlock</button></div>{credential&&<div className="credential"><b>Verified hospital credential</b><span>ID: {credential.credentialSubject.credentialId}</span><span>Issuer: {credential.issuerName||credential.issuer?.name||credential.issuer||'Unknown hospital'}</span><span>Patient: {credential.credentialSubject.patientName}</span><span>Age: {credential.credentialSubject.age}</span><span>Biomarker: {credential.credentialSubject.biomarker}</span><span>Diagnosis code: {credential.credentialSubject.diagnosisCode}</span></div>}</div>
 <div className="card"><h2>2. Trial & local proof</h2><label>Open trial<select value={trialId} onChange={e=>{setTrialId(e.target.value);setProofBundle(null)}}>{trials.map(t=><option key={t.id} value={t.id}>#{t.id} — {t.title}</option>)}</select></label>{trial&&<div className="criteria"><span>Age {trial.minAge}–{trial.maxAge}</span><span>Biomarker {trial.minBiomarker}–{trial.maxBiomarker}</span><span>Diagnosis {trial.requiredDiagnosis}</span></div>}<button className="primary" onClick={prove}>Check & prove locally</button><button disabled={!proofBundle} onClick={submit}>Submit anonymous proof</button></div></section>
 <section className="status"><b>Status</b><p>{status||'Ready.'}</p></section></main>
}
createRoot(document.getElementById('root')).render(<App/>);
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));

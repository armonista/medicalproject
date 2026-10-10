import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';import QRCode from'qrcode';import'./styles.css';
const API=import.meta.env.VITE_API_URL||'';
async function fetchWithRetry(url,options,retries=1){
  try{return await fetch(url,options)}catch(e){
    if(retries>0){await new Promise(r=>setTimeout(r,500));return fetchWithRetry(url,options,retries-1)}
    throw e;
  }
}
const initial={patientReference:'',patientName:'',age:42,biomarker:110,diagnosisCode:101,validityDays:365};
function App(){const[token,setToken]=useState(localStorage.getItem('bm-hospital-token')||''),[user,setUser]=useState(null),[email,setEmail]=useState('hospital@blindmatch.local'),[password,setPassword]=useState('Hospital@123'),[hospital,setHospital]=useState(null),[form,setForm]=useState(initial),[issued,setIssued]=useState(null),[qr,setQr]=useState(''),[items,setItems]=useState([]),[message,setMessage]=useState('');const headers=()=>({'Content-Type':'application/json',Authorization:`Bearer ${token}`});
async function login(e){e.preventDefault();const r=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const x=await r.json();if(!r.ok)return setMessage(x.error||'Login failed');if(x.user.role!=='HOSPITAL')return setMessage('This account is not a Hospital account');localStorage.setItem('bm-hospital-token',x.token);setToken(x.token);setUser(x.user);setMessage('Logged in.');setTimeout(()=>refresh(x.token),0)}
async function refresh(t=token){if(!t)return;const h={Authorization:`Bearer ${t}`};const [a,b]=await Promise.all([fetch(`${API}/api/hospital/profile`,{headers:h}),fetch(`${API}/api/hospital/credentials`,{headers:h})]);if(a.status===401){logout();return}setHospital(await a.json());setItems(await b.json())}
useEffect(()=>{if(token){fetch(`${API}/api/auth/me`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():Promise.reject()).then(x=>{setUser(x.user);refresh(token)}).catch(()=>logout())}},[]);
function logout(){localStorage.removeItem('bm-hospital-token');setToken('');setUser(null);setHospital(null);setItems([])}
async function issue(e){e.preventDefault();setMessage('Issuing and signing credential…');const body={...form,age:Number(form.age),biomarker:Number(form.biomarker),diagnosisCode:Number(form.diagnosisCode),validityDays:Number(form.validityDays)};const r=await fetchWithRetry(`${API}/api/hospital/credentials`,{method:'POST',headers:headers(),body:JSON.stringify(body)});const x=await r.json();if(!r.ok)return setMessage(x.error||'Issue failed');const code=x.handoffCode;setIssued({...x,transferCode:code});setQr(await QRCode.toDataURL(code,{width:420,margin:4,errorCorrectionLevel:'Q'}));setMessage(`Credential ${x.credentialSubject.credentialId} signed successfully.`);refresh()}
async function revoke(id){if(!confirm(`Revoke credential ${id}?`))return;const r=await fetch(`${API}/api/hospital/credentials/${encodeURIComponent(id)}/revoke`,{method:'POST',headers:headers(),body:JSON.stringify({reason:'Revoked by hospital operator'})});const x=await r.json();setMessage(r.ok?`${id} revoked.`:(x.error||'Revocation failed'));refresh()}
function download(){if(!issued)return;const blob=new Blob([JSON.stringify(issued,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${issued.credentialSubject.credentialId}.json`;a.click();URL.revokeObjectURL(a.href)}async function copyCode(){
  const code=issued?.transferCode;
  if(!code)return setMessage('No transfer code is available. Issue a new credential first.');
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(code);
      setMessage('Credential transfer code copied.');
      return;
    }
    throw new Error('Clipboard API unavailable');
  }catch(_err){
    try{
      const ta=document.createElement('textarea');
      ta.value=code;
      ta.setAttribute('readonly','');
      ta.style.position='fixed';
      ta.style.opacity='0';
      ta.style.pointerEvents='none';
      document.body.appendChild(ta);
      ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);
      const ok=document.execCommand('copy');
      document.body.removeChild(ta);
      if(ok){setMessage('Credential transfer code copied.');return;}
    }catch{}
    // Final fallback: make the value visible so the user can long-press/copy.
    setMessage(`Copy this transfer code manually: ${code}`);
  }
}
if(!token||!user)return <main className="shell"><header className="hero"><div><span className="eyebrow">BlindMatch 2.0</span><h1>Hospital Login</h1><p>Only approved hospital operators can issue or revoke clinical credentials.</p></div></header><form className="card" onSubmit={login}><h2>Sign in</h2><label>Email<input value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary">Login</button>{message&&<p className="message">{message}</p>}</form></main>;
return <main className="shell"><header className="hero"><div><span className="eyebrow">BlindMatch 2.0</span><h1>Hospital Issuer Portal</h1><p>{user.displayName} · <b>{user.organizationId}</b></p><p>Verify clinical information and issue a signed patient-held credential.</p></div><div><span className="badge">Authorized Issuer</span><button onClick={logout}>Logout</button></div></header>{hospital&&<section className="identity"><b>{hospital.name}</b><span>{hospital.hospitalId}</span><code>{hospital.signerAddress}</code></section>}<section className="grid"><form className="card" onSubmit={issue}><h2>Issue clinical credential</h2><p className="muted">These fields represent information verified from the hospital EHR. Raw fields are returned in the signed patient credential, not stored in the central registry.</p><label>Hospital patient / MRN reference<input required value={form.patientReference} onChange={e=>setForm({...form,patientReference:e.target.value})}/></label><label>Patient name<input required value={form.patientName} onChange={e=>setForm({...form,patientName:e.target.value})}/></label><div className="two"><label>Age<input type="number" required value={form.age} onChange={e=>setForm({...form,age:e.target.value})}/></label><label>Biomarker<input type="number" required value={form.biomarker} onChange={e=>setForm({...form,biomarker:e.target.value})}/></label></div><div className="two"><label>Diagnosis code<input type="number" required value={form.diagnosisCode} onChange={e=>setForm({...form,diagnosisCode:e.target.value})}/></label><label>Validity (days)<input type="number" required min="1" value={form.validityDays} onChange={e=>setForm({...form,validityDays:e.target.value})}/></label></div><button className="primary">Verify & issue signed credential</button>{message&&<p className="message">{message}</p>}</form><section className="card"><h2>Patient handoff</h2>{!issued?<p className="muted">Issue a credential to create the patient transfer QR.</p>:<><div className="success"><b>{issued.credentialSubject.credentialId}</b><span>Digitally signed by {hospital?.name}</span><span>Expires {new Date(issued.validUntil).toLocaleDateString()}</span></div>{qr&&<img className="qr" src={qr} alt="Patient credential QR"/>}<p className="hint">QR contains a short one-time claim token only.</p><div className="actions"><button type="button" onClick={copyCode}>Copy transfer code</button><button type="button" onClick={download}>Download JSON</button></div></>}</section></section><section className="card wide"><div className="sectionHead"><div><h2>Credential registry</h2><p className="muted">Status metadata only.</p></div><button onClick={()=>refresh()}>Refresh</button></div>{items.length===0?<p className="muted">No credentials issued yet.</p>:<div className="table"><div className="row head"><span>Credential</span><span>Issued</span><span>Expires</span><span>Status</span><span></span></div>{items.map(x=><div className="row" key={x.credentialId}><code>{x.credentialId}</code><span>{new Date(x.issuedAt).toLocaleDateString()}</span><span>{new Date(x.expiresAt).toLocaleDateString()}</span><b className={x.status==='ACTIVE'?'active':'revoked'}>{x.status}</b><span>{x.status==='ACTIVE'&&<button onClick={()=>revoke(x.credentialId)}>Revoke</button>}</span></div>)}</div>}</section></main>}
createRoot(document.getElementById('root')).render(<App/>);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { config } from './config.js';
import { createTrial, getTrial, listTrials } from './store.js';
import { hospitalProfile, issueDemoCredential, issueHospitalCredential } from './issuer.js';
import { getCredentialMetadata, listCredentialMetadata, revokeCredential } from './credentialStore.js';
import { submitProofOnChain } from './chain.js';
import { createCredentialHandoff, claimCredentialHandoff } from './handoffStore.js';
import adminRoutes from './routes/admin.js';
import { login, requireApprovedRole, requireAuth } from './auth.js';
import { get, run, all, audit, dbPath } from './database.js';

const app=express();
app.use(helmet());
app.use(cors({origin:true}));
app.use(express.json({limit:'250kb'}));

const trialSchema=z.object({title:z.string().min(3).max(120),sponsor:z.string().min(2).max(120),minAge:z.number().int().min(0).max(120),maxAge:z.number().int().min(0).max(120),minBiomarker:z.number().int().min(0).max(65535),maxBiomarker:z.number().int().min(0).max(65535),requiredDiagnosis:z.number().int().min(0).max(65535)}).refine(v=>v.minAge<=v.maxAge,'Invalid age range').refine(v=>v.minBiomarker<=v.maxBiomarker,'Invalid biomarker range');
const issueDemoSchema=z.object({age:z.number().int().min(0).max(120),biomarker:z.number().int().min(0).max(65535),diagnosisCode:z.number().int().min(0).max(65535),salt:z.string().regex(/^\d+$/).max(70).optional()});
const hospitalIssueSchema=z.object({patientReference:z.string().min(2).max(80),patientName:z.string().min(2).max(120),age:z.number().int().min(0).max(120),biomarker:z.number().int().min(0).max(65535),diagnosisCode:z.number().int().min(0).max(65535),validityDays:z.number().int().min(1).max(3650).default(365)});
const revokeSchema=z.object({reason:z.string().min(3).max(200).default('Revoked by issuer')});
const matchSchema=z.object({trialId:z.number().int().positive(),ephemeralPatient:z.string().regex(/^0x[a-fA-F0-9]{40}$/),credentialId:z.string().min(1).optional(),proof:z.any(),publicSignals:z.array(z.string()).length(7),mode:z.enum(['zk','demo']).default('zk')});

app.post('/api/auth/login',async(req,res,next)=>{try{const {email,password}=req.body||{};if(!email||!password)return res.status(400).json({error:'Email and password required'});const result=await login(email,password);if(!result)return res.status(401).json({error:'Invalid email or password'});if(result.blocked)return res.status(403).json({error:`Organization is ${result.status}`});audit('LOGIN_SUCCESS',result.user,{email:result.user.email});res.json(result)}catch(e){next(e)}});
app.get('/api/auth/me',requireAuth,(req,res)=>res.json({user:req.user}));
app.use('/api/admin',adminRoutes);
app.get('/api/health',(_req,res)=>res.json({ok:true,service:'blindmatch-api',demoMode:config.demoMode,database:dbPath()}));

const hospitalGuard=requireApprovedRole('HOSPITAL','HOSPITAL');
const researcherGuard=requireApprovedRole('RESEARCHER','RESEARCH_ORG');

app.get('/api/hospital/profile',...hospitalGuard,(req,res)=>res.json(hospitalProfile(req.organization)));
app.get('/api/hospital/credentials',...hospitalGuard,async(req,res,next)=>{try{res.json(await listCredentialMetadata(req.organization.id))}catch(e){next(e)}});
app.post('/api/hospital/credentials',...hospitalGuard,async(req,res,next)=>{try{const input=hospitalIssueSchema.parse(req.body);const credential=await issueHospitalCredential(input,req.organization,req.user);const handoff=createCredentialHandoff(credential);res.status(201).json({...credential,handoffCode:handoff.code,handoffExpiresAt:handoff.expiresAt})}catch(e){next(e)}});
app.post('/api/hospital/handoffs/:token/claim',(req,res)=>{const credential=claimCredentialHandoff(req.params.token);if(!credential)return res.status(404).json({error:'QR handoff expired, already used, or invalid. Ask the hospital to issue/show a new QR.'});res.json(credential)});
app.post('/api/hospital/credentials/:id/revoke',...hospitalGuard,async(req,res,next)=>{try{const {reason}=revokeSchema.parse(req.body||{});const item=await revokeCredential(req.params.id,reason,req.user);if(!item)return res.status(404).json({error:'Credential not found'});res.json(item)}catch(e){next(e)}});

app.get('/api/credentials/:id/status',async(req,res,next)=>{try{const item=await getCredentialMetadata(req.params.id);if(!item)return res.status(404).json({error:'Credential not found'});res.json({credentialId:item.credentialId,status:item.status,issuerName:item.issuerName,issuerOrganizationId:item.organizationId,issuerHospitalId:item.issuerHospitalId,issuedAt:item.issuedAt,expiresAt:item.expiresAt,revokedAt:item.revokedAt||null,revocationReason:item.revocationReason||null})}catch(e){next(e)}});
app.get('/api/trials',async(_req,res,next)=>{try{res.json(await listTrials())}catch(e){next(e)}});
app.post('/api/trials',...researcherGuard,async(req,res,next)=>{try{const parsed=trialSchema.parse(req.body);res.status(201).json(await createTrial(parsed,req.user))}catch(e){next(e)}});
app.post('/api/issuer/demo-credential',async(req,res,next)=>{try{res.json(await issueDemoCredential(issueDemoSchema.parse(req.body)))}catch(e){next(e)}});

app.post('/api/matches/verify',async(req,res,next)=>{try{
  const body=matchSchema.parse(req.body),trial=await getTrial(body.trialId);if(!trial)return res.status(404).json({error:'Trial not found'});
  if(body.credentialId){const status=await getCredentialMetadata(body.credentialId);if(!status)return res.status(400).json({error:'Credential is not registered by an approved hospital'});if(status.status!=='ACTIVE')return res.status(400).json({error:`Credential status is ${status.status}`});if(new Date(status.expiresAt).getTime()<=Date.now())return res.status(400).json({error:'Credential has expired'});if(String(status.credentialCommitment)!==String(body.publicSignals[0]))return res.status(400).json({error:'ZK credential commitment does not match the hospital-issued credential'});}
  let match;
  if(body.mode==='demo'){
    if(!config.demoMode)return res.status(400).json({error:'Demo proofs disabled'});
    match={matchId:crypto.randomUUID(),trialId:body.trialId,ephemeralPatient:body.ephemeralPatient,credentialCommitment:body.publicSignals[0],verifiedAt:new Date().toISOString(),verification:'DEMO_ONLY'};
  } else {
    if(config.demoMode)return res.status(400).json({error:'Real ZK proof submitted while API is in DEMO_MODE=true'});
    const expected=[String(trial.minAge),String(trial.maxAge),String(trial.minBiomarker),String(trial.maxBiomarker),String(trial.requiredDiagnosis),String(trial.id)];if(body.publicSignals.slice(1).some((x,i)=>x!==expected[i]))return res.status(400).json({error:'Public signals do not match published trial criteria'});
    const chain=await submitProofOnChain(body);match={matchId:chain.txHash,trialId:body.trialId,ephemeralPatient:body.ephemeralPatient,credentialCommitment:body.publicSignals[0],verifiedAt:new Date().toISOString(),verification:'ON_CHAIN',...chain};
  }
  run('INSERT OR REPLACE INTO matches(match_id,trial_id,ephemeral_patient,credential_commitment,verified_at,verification,tx_hash,block_number) VALUES(?,?,?,?,?,?,?,?)',[match.matchId,match.trialId,match.ephemeralPatient,match.credentialCommitment,match.verifiedAt,match.verification,match.txHash||null,match.blockNumber||null]);audit('MATCH_VERIFIED',{role:'PATIENT'},{trialId:match.trialId,verification:match.verification,matchId:match.matchId});res.json({ok:true,...match});
}catch(e){next(e)}});
app.get('/api/matches',...researcherGuard,(req,res)=>{const trialId=req.query.trialId?Number(req.query.trialId):null;const rows=all(trialId?'SELECT * FROM matches WHERE trial_id=? ORDER BY verified_at DESC':'SELECT * FROM matches ORDER BY verified_at DESC',trialId?[trialId]:[]);res.json(rows.map(m=>({matchId:m.match_id,trialId:Number(m.trial_id),ephemeralPatient:m.ephemeral_patient,credentialCommitment:m.credential_commitment,verifiedAt:m.verified_at,verification:m.verification,txHash:m.tx_hash,blockNumber:m.block_number}))) });

app.use((err,_req,res,_next)=>{console.error(err);if(err?.name==='ZodError')return res.status(400).json({error:'Validation failed',details:err.issues});const status=Number(err?.statusCode)||500;res.status(status).json({error:err?.message||'Internal server error'})});
app.listen(config.port,'0.0.0.0',()=>console.log(`BlindMatch API running on http://localhost:${config.port} (demoMode=${config.demoMode})`));

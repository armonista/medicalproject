import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { all, get, run, audit } from '../database.js';
import { requireRole } from '../auth.js';

const r=Router();
const adminOnly=requireRole('ADMIN');
r.use(...adminOnly);

const mapOrg=o=>({id:o.id,type:o.type,name:o.name,status:o.status,publicKey:o.public_key||'',createdAt:o.created_at,approvedAt:o.approved_at||null});
const mapUser=u=>({id:u.id,email:u.email,displayName:u.display_name,role:u.role,organizationId:u.organization_id||null,active:Boolean(u.active),createdAt:u.created_at});

r.get('/organizations',(req,res)=>res.json(all('SELECT * FROM organizations ORDER BY created_at DESC').map(mapOrg)));
r.post('/organizations',(req,res)=>{
  const {type,name,publicKey=''}=req.body||{}; if(!['HOSPITAL','RESEARCH_ORG'].includes(type))return res.status(400).json({error:'type must be HOSPITAL or RESEARCH_ORG'}); if(!name?.trim())return res.status(400).json({error:'name required'});
  const org={id:crypto.randomUUID(),type,name:name.trim(),status:'PENDING',publicKey,createdAt:new Date().toISOString(),approvedAt:null};
  run('INSERT INTO organizations(id,type,name,status,public_key,created_at,approved_at) VALUES(?,?,?,?,?,?,NULL)',[org.id,org.type,org.name,org.status,org.publicKey,org.createdAt]);audit('ORGANIZATION_REGISTERED',req.user,{organizationId:org.id,type:org.type,name:org.name});res.status(201).json(org);
});
r.patch('/organizations/:id/status',(req,res)=>{const org=get('SELECT * FROM organizations WHERE id=?',[req.params.id]);if(!org)return res.status(404).json({error:'Organization not found'});const {status}=req.body||{};if(!['APPROVED','REJECTED','SUSPENDED','PENDING'].includes(status))return res.status(400).json({error:'Invalid status'});const approvedAt=status==='APPROVED'?new Date().toISOString():org.approved_at;run('UPDATE organizations SET status=?,approved_at=? WHERE id=?',[status,approvedAt,req.params.id]);audit('ORGANIZATION_STATUS_CHANGED',req.user,{organizationId:req.params.id,status});res.json(mapOrg(get('SELECT * FROM organizations WHERE id=?',[req.params.id])))});
r.patch('/organizations/:id/key',(req,res)=>{if(!get('SELECT id FROM organizations WHERE id=?',[req.params.id]))return res.status(404).json({error:'Organization not found'});run('UPDATE organizations SET public_key=? WHERE id=?',[(req.body?.publicKey||'').trim(),req.params.id]);audit('ORGANIZATION_KEY_UPDATED',req.user,{organizationId:req.params.id});res.json(mapOrg(get('SELECT * FROM organizations WHERE id=?',[req.params.id])))});

r.get('/users',(req,res)=>res.json(all('SELECT id,email,display_name,role,organization_id,active,created_at FROM users ORDER BY created_at DESC').map(mapUser)));
r.post('/users',async(req,res)=>{const {email,password,displayName,role,organizationId=null}=req.body||{};if(!email||!password||!displayName||!['ADMIN','HOSPITAL','RESEARCHER'].includes(role))return res.status(400).json({error:'email, password, displayName and valid role are required'});if(get('SELECT id FROM users WHERE lower(email)=lower(?)',[email]))return res.status(409).json({error:'Email already exists'});if(role!=='ADMIN'){const expected=role==='HOSPITAL'?'HOSPITAL':'RESEARCH_ORG';const org=get('SELECT * FROM organizations WHERE id=? AND type=?',[organizationId,expected]);if(!org)return res.status(400).json({error:`Select a ${expected} organization`});}
  const id=crypto.randomUUID(),hash=await bcrypt.hash(password,10),createdAt=new Date().toISOString();run('INSERT INTO users(id,email,password_hash,display_name,role,organization_id,active,created_at) VALUES(?,?,?,?,?,?,1,?)',[id,email.toLowerCase(),hash,displayName,role,role==='ADMIN'?null:organizationId,createdAt]);audit('USER_CREATED',req.user,{userId:id,email,role,organizationId});res.status(201).json(mapUser(get('SELECT * FROM users WHERE id=?',[id])));
});
r.patch('/users/:id/active',(req,res)=>{const active=req.body?.active?1:0;if(!get('SELECT id FROM users WHERE id=?',[req.params.id]))return res.status(404).json({error:'User not found'});run('UPDATE users SET active=? WHERE id=?',[active,req.params.id]);audit('USER_STATUS_CHANGED',req.user,{userId:req.params.id,active:Boolean(active)});res.json(mapUser(get('SELECT * FROM users WHERE id=?',[req.params.id])))});

r.get('/audit',(req,res)=>res.json(all('SELECT * FROM audit ORDER BY timestamp DESC LIMIT 300').map(x=>({id:x.id,action:x.action,actorUserId:x.actor_user_id,actorRole:x.actor_role,organizationId:x.organization_id,details:JSON.parse(x.details_json||'{}'),timestamp:x.timestamp}))));
r.get('/summary',(req,res)=>{const orgs=all('SELECT * FROM organizations'),counts={};for(const o of orgs)counts[o.status]=(counts[o.status]||0)+1;res.json({organizations:orgs.length,hospitals:orgs.filter(o=>o.type==='HOSPITAL').length,researchOrganizations:orgs.filter(o=>o.type==='RESEARCH_ORG').length,statusCounts:counts,users:Number(get('SELECT COUNT(*) c FROM users').c),credentials:Number(get('SELECT COUNT(*) c FROM credentials').c),trials:Number(get('SELECT COUNT(*) c FROM trials').c),matches:Number(get('SELECT COUNT(*) c FROM matches').c)})});
export default r;

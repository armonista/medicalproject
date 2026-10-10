import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { get } from './database.js';

const secret = () => process.env.JWT_SECRET || 'blindmatch-development-jwt-secret-change-me';

export async function login(email, password) {
  const user = get('SELECT * FROM users WHERE lower(email)=lower(?)', [email]);
  if (!user || !user.active) return null;
  if (!(await bcrypt.compare(password, user.password_hash))) return null;
  if (user.organization_id) {
    const org = get('SELECT * FROM organizations WHERE id=?', [user.organization_id]);
    if (!org || org.status !== 'APPROVED') return { blocked: true, status: org?.status || 'UNKNOWN' };
  }
  const profile = {
    userId: user.id, email: user.email, displayName: user.display_name,
    role: user.role, organizationId: user.organization_id || null
  };
  const token = jwt.sign(profile, secret(), { expiresIn: '8h', issuer: 'blindmatch-api' });
  return { token, user: profile };
}

export function requireAuth(req,res,next) {
  const h = req.header('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error:'Login required' });
  try { req.user = jwt.verify(token, secret(), { issuer:'blindmatch-api' }); next(); }
  catch { return res.status(401).json({ error:'Session expired or invalid. Please log in again.' }); }
}

export function requireRole(...roles) {
  return [requireAuth, (req,res,next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error:`Role ${req.user.role} is not allowed for this action` })];
}

export function requireApprovedRole(role, orgType) {
  return [requireAuth, (req,res,next) => {
    if (req.user.role !== role) return res.status(403).json({ error:`${role} role required` });
    if (!req.user.organizationId) return res.status(403).json({ error:'User is not assigned to an organization' });
    const org = get('SELECT * FROM organizations WHERE id=? AND type=?', [req.user.organizationId, orgType]);
    if (!org) return res.status(403).json({ error:`Unknown ${orgType}` });
    if (org.status !== 'APPROVED') return res.status(403).json({ error:`Organization is ${org.status}` });
    req.organization = org;
    next();
  }];
}

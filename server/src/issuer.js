import { Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { buildPoseidon } from 'circomlibjs';
import { registerCredentialMetadata } from './credentialStore.js';
import { audit } from './database.js';

let poseidonPromise;
async function credentialCommitment(subject) {
  poseidonPromise ||= buildPoseidon();
  const poseidon = await poseidonPromise;
  const out = poseidon([BigInt(subject.age), BigInt(subject.biomarker), BigInt(subject.diagnosisCode), BigInt(subject.salt)]);
  return poseidon.F.toString(out);
}

const issuer = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
export const baseHospital = { hospitalId:'HOSP-DEMO-001', did:`did:pkh:eip155:31337:${issuer.address}`, signerAddress:issuer.address };
export function hospitalProfile(org){return {...baseHospital,name:org?.name||'BlindMatch Hospital',organizationId:org?.id||null};}

export function canonicalCredentialSubject(subject) {
  return JSON.stringify({credentialId:String(subject.credentialId),patientReference:String(subject.patientReference||''),patientName:String(subject.patientName||''),age:Number(subject.age),biomarker:Number(subject.biomarker),diagnosisCode:Number(subject.diagnosisCode),salt:String(subject.salt)});
}
async function signCredentialSubject(subject,expiresAt,org,actor){
  const payload=canonicalCredentialSubject(subject); const payloadHash=keccak256(toUtf8Bytes(payload)); const signature=await issuer.signMessage(payloadHash); const now=new Date().toISOString();
  const hospital=hospitalProfile(org);
  const vc={'@context':['https://www.w3.org/ns/credentials/v2'],id:`urn:blindmatch:credential:${subject.credentialId}`,type:['VerifiableCredential','BlindMatchClinicalCredential'],issuer:hospital.did,issuerName:hospital.name,issuerOrganizationId:org.id,issuerHospitalId:hospital.hospitalId,validFrom:now,validUntil:expiresAt,credentialSubject:subject,credentialStatus:{id:`/api/credentials/${subject.credentialId}/status`,type:'BlindMatchCredentialStatus2026'},proof:{type:'EthereumPersonalSignature2026',verificationMethod:issuer.address,payloadHash,signature}};
  const commitment=await credentialCommitment(subject);
  await registerCredentialMetadata({credentialId:subject.credentialId,organizationId:org.id,issuerHospitalId:hospital.hospitalId,issuerName:hospital.name,payloadHash,credentialCommitment:commitment,issuedAt:now,expiresAt,status:'ACTIVE'});
  audit('CREDENTIAL_ISSUED',actor,{credentialId:subject.credentialId,issuerName:hospital.name,expiresAt});
  return vc;
}
export async function issueHospitalCredential(input,org,actor){
  const credentialId=`BMVC-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const salt=String(BigInt('0x'+Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex')));
  const subject={credentialId,patientReference:input.patientReference,patientName:input.patientName,age:Number(input.age),biomarker:Number(input.biomarker),diagnosisCode:Number(input.diagnosisCode),salt};
  const expiresAt=new Date(Date.now()+Number(input.validityDays||365)*86400000).toISOString();
  return signCredentialSubject(subject,expiresAt,org,actor);
}
export async function issueDemoCredential(subject){
  const org={id:'org-hospital-demo',name:'BlindMatch Demo Hospital'}; const actor={userId:'demo',role:'HOSPITAL',organizationId:org.id};
  return issueHospitalCredential({patientReference:`DEMO-${crypto.randomUUID().slice(0,6).toUpperCase()}`,patientName:'Demo Patient',age:subject.age,biomarker:subject.biomarker,diagnosisCode:subject.diagnosisCode,validityDays:365},org,actor);
}

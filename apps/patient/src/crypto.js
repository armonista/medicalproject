const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function derive(pin, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

export async function encryptJson(value, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(pin, salt);
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value)));
  return {salt:b64(salt),iv:b64(iv),cipher:b64(new Uint8Array(cipher))};
}

export async function decryptJson(bundle, pin) {
  const salt=unb64(bundle.salt), iv=unb64(bundle.iv), cipher=unb64(bundle.cipher);
  const key=await derive(pin,salt);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher);
  return JSON.parse(dec.decode(plain));
}

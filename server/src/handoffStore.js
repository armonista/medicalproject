const handoffs=new Map();
const TTL_MS=10*60*1000;
function cleanup(){const now=Date.now();for(const[token,item]of handoffs)if(item.expiresAt<=now)handoffs.delete(token)}
export function createCredentialHandoff(credential){cleanup();const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','').slice(0,12);const expiresAt=Date.now()+TTL_MS;handoffs.set(token,{credential,expiresAt});return{code:`blindmatch-claim:${token}`,expiresAt:new Date(expiresAt).toISOString()}}
export function claimCredentialHandoff(token){cleanup();const item=handoffs.get(token);if(!item)return null;handoffs.delete(token);return item.credential}

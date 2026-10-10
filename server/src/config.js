import 'dotenv/config';
export const config={port:Number(process.env.PORT||4000),demoMode:String(process.env.DEMO_MODE||'true').toLowerCase()==='true',rpcUrl:process.env.RPC_URL||'http://127.0.0.1:8545',relayerPrivateKey:process.env.RELAYER_PRIVATE_KEY||'',matchRegistryAddress:process.env.MATCH_REGISTRY_ADDRESS||''};

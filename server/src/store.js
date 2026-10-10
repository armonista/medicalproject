import { all, get, run, audit } from './database.js';

function mapTrial(x){return x&&({id:Number(x.id),organizationId:x.organization_id,title:x.title,sponsor:x.sponsor,minAge:Number(x.min_age),maxAge:Number(x.max_age),minBiomarker:Number(x.min_biomarker),maxBiomarker:Number(x.max_biomarker),requiredDiagnosis:Number(x.required_diagnosis),status:x.status,createdAt:x.created_at});}
export async function listTrials(){return all('SELECT * FROM trials ORDER BY id DESC').map(mapTrial)}
export async function getTrial(id){return mapTrial(get('SELECT * FROM trials WHERE id=?',[Number(id)]))}
export async function createTrial(input, actor){
  if (!actor?.organizationId) {
    const err = new Error('Researcher is not assigned to an organization');
    err.statusCode = 403;
    throw err;
  }

  const org = get('SELECT id,status,type FROM organizations WHERE id=?', [actor.organizationId]);
  if (!org || org.type !== 'RESEARCH_ORG' || org.status !== 'APPROVED') {
    const err = new Error('Approved research organization required');
    err.statusCode = 403;
    throw err;
  }

  const createdAt = new Date().toISOString();
  run(`INSERT INTO trials(organization_id,title,sponsor,min_age,max_age,min_biomarker,max_biomarker,required_diagnosis,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,[
    actor.organizationId,input.title,input.sponsor,input.minAge,input.maxAge,input.minBiomarker,input.maxBiomarker,input.requiredDiagnosis,'OPEN',createdAt
  ]);

  // SQL.js persistence exports the database after each write. Do not rely on
  // last_insert_rowid() surviving that export/import boundary. Look up the
  // row we just inserted using stable values instead.
  const trial = mapTrial(get(
    `SELECT * FROM trials
     WHERE organization_id=? AND created_at=? AND title=?
     ORDER BY id DESC LIMIT 1`,
    [actor.organizationId, createdAt, input.title]
  ));

  if (!trial) {
    throw new Error('Trial was inserted but could not be reloaded');
  }

  audit('TRIAL_CREATED',actor,{trialId:trial.id,title:trial.title});
  return trial;
}

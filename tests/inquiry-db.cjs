// Executes the actual migration/functions in disposable WASM PostgreSQL.
// This is schema/permission/transaction evidence, not Supabase deployment proof.
const {PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
(async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(readFileSync('supabase/migrations/202610120001_universe_inquiries.sql','utf8'));
  const payload={replyEmail:'fixture@example.test',projectSummary:'A disposable inquiry used to verify private persistence.',inquiryType:'general',serviceId:'',referencedUrl:'',consentVersion:'2026-10-12',sourcePublicPageId:'world:work'};
  const receive=async(key=randomUUID(),fingerprint='a'.repeat(64),ip='test-ip',email='test-email',value=payload)=>{
   const {rows}=await db.query('select public.receive_universe_inquiry($1::uuid,$2::text,$3::jsonb,$4::text,$5::text,$6::text) as receipt',[key,fingerprint,JSON.stringify(value),ip,email,'unconfigured']);return rows[0].receipt;
  };
  const key=randomUUID(),first=await receive(key),retry=await receive(key);
  assert.equal(first.request_id,retry.request_id);assert.equal(retry.duplicate,true);
  assert.equal((await db.query('select count(*)::int as n from public.universe_inquiries')).rows[0].n,1);
  await assert.rejects(receive(key,'b'.repeat(64)),/IDEMPOTENCY_CONFLICT/);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   try {
    await assert.rejects(db.query('select * from public.universe_inquiries'),/permission denied/);
    await assert.rejects(receive(randomUUID()),/permission denied/);
    await assert.rejects(db.query('delete from public.universe_inquiries'),/permission denied/);
   }finally{await db.exec('reset role');}
  }
  await db.exec('set role service_role');
  try {assert.equal((await db.query('select count(*)::int as n from public.universe_inquiries')).rows[0].n,1);}
  finally {await db.exec('reset role');}
  for(let i=0;i<8;i++)await receive(randomUUID(),'a'.repeat(64),'ip-limit','ip-email-'+i);
  await assert.rejects(receive(randomUUID(),'a'.repeat(64),'ip-limit','ip-email-9'),/RATE_LIMIT/);
  for(let i=0;i<3;i++)await receive(randomUUID(),'a'.repeat(64),'email-ip-'+i,'email-limit');
  await assert.rejects(receive(randomUUID(),'a'.repeat(64),'email-ip-4','email-limit'),/RATE_LIMIT/);
  const before=(await db.query('select count(*)::int as n from public.universe_inquiries')).rows[0].n;
  await assert.rejects(receive(randomUUID(),'a'.repeat(64),'invalid-ip','invalid-email',{...payload,projectSummary:'short'}),/check constraint/);
  assert.equal((await db.query('select count(*)::int as n from public.universe_inquiries')).rows[0].n,before);
  await db.query("update public.universe_inquiries set expires_at=now()-interval '1 day' where id=$1",[first.request_id]);
  await db.query("update public.universe_inquiry_rate_buckets set resets_at=now()-interval '2 days'");
  await db.query('select public.purge_universe_inquiries()');
  assert.equal((await db.query('select count(*)::int as n from public.universe_inquiries where id=$1',[first.request_id])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from public.universe_inquiry_rate_buckets')).rows[0].n,0);
  console.log(JSON.stringify({result:'PASS',database:'disposable PostgreSQL',checks:['migration','private permissions','service-role access','same-key receipt','changed-body conflict','IP limit','email limit','failed insert rollback','expiry purge']}));
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exit(1);});

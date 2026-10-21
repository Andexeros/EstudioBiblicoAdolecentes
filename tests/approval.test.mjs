import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NEON_AUTH_SESSION_COOKIE_NAME as TOKEN } from '@neondatabase/auth/server';
import { sessionEndpoint, preferencesEndpoint, lessonsEndpoint, usersEndpoint, adminEndpoint } from '../server/api.js';
import { authProxy } from '../server/auth.js';
import { fromNode, HttpError } from '../server/http.js';
import { normalizeFullName, validFullName } from '../name-rules.js';

const origin='https://huellas.example', baseUrl='https://auth.example/neondb/auth';
const config={origin,baseUrl,cookieSecret:'test-secret-only-012345678901234567890',sessionDataTtl:60,sameSite:'lax'};
const time=new Date().toISOString();
const person={id:'session-user',name:'Ana Pérez',email:'ana@example.com',emailVerified:true,createdAt:time,updatedAt:time};
const request=(path,body,headers={})=>new Request(origin+path,{
  method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:`${TOKEN}=test-session`,...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
});
const reject=(promise,code)=>assert.rejects(promise,error=>error instanceof HttpError&&error.code===code);
const command=(action='approve',more={})=>({action,userId:'target-user',version:3,confirmed:true,...more});
function sqlResponse(rows){
  const names=Object.keys(rows[0]||{}),types=names.map(name=>{const v=rows.find(row=>row[name]!=null)?.[name];return typeof v==='boolean'?16:typeof v==='object'?3802:25;});
  return Response.json({fields:names.map((name,i)=>({name,dataTypeID:types[i]})),rows:rows.map(row=>names.map((name,i)=>row[name]==null?null:types[i]===16?(row[name]?'t':'f'):types[i]===3802?JSON.stringify(row[name]):String(row[name]))),rowCount:rows.length,command:'SELECT'});
}
function backend(t,options={}){
  const state={user:{...person},member:{user_id:person.id,status:'approved',role:'user',version:1,study_group:'adolescentes',deletion_id:null},allowed:true,identityPresent:false,...options};
  const queries=[],authCalls=[],management=[];
  t.mock.method(globalThis,'fetch',async(url,init={})=>{
    url=String(url);
    if(url.startsWith(baseUrl)){
      authCalls.push({url,init});
      if(url.includes('/get-session'))return Response.json(state.user?{user:state.user,session:{id:'session',userId:state.user.id,token:'test-session',createdAt:time,updatedAt:time,expiresAt:new Date(Date.now()+3600000).toISOString()}}:null);
      return Response.json({status:true});
    }
    if(url.startsWith('https://console.neon.tech/')){
      management.push({url,init});
      if(init.method==='DELETE')return new Response(null,{status:state.deleteStatus||204});
      return Response.json({auth_provider:'better_auth',branch_id:'br-test',db_name:'neondb',base_url:baseUrl,...state.integration});
    }
    const {query,params}=JSON.parse(init.body);queries.push({query,params});
    if(query.includes('huellas:membership'))return sqlResponse(state.member?[state.member]:[]);
    if(query.includes('huellas:initialize'))return sqlResponse([]);
    if(query.includes('huellas:limit'))return sqlResponse([{allowed:state.allowed}]);
    if(query.includes('huellas:own-group')){state.member.study_group=params[1];state.member.version++;return sqlResponse([]);}
    if(query.includes('huellas:action')){
      if(state.actionError)return Response.json({message:state.actionError,code:'P0001'},{status:400});
      return sqlResponse([{result:{operationId:'52b9f233-61b2-4906-bdfe-f0722559f604',version:4}}]);
    }
    if(query.includes('huellas:finish-delete'))return sqlResponse([]);
    if(query.includes('huellas:identity-exists'))return sqlResponse([{present:state.identityPresent}]);
    if(query.includes('huellas:users'))return sqlResponse(state.users||[]);
    if(query.includes('huellas:overview'))return sqlResponse([{total:3,pending:1,approved:1,blocked:1,rejected:0,new7:2,new30:3,adolescentes:1,intermedio:1,grande:0,unassigned:1}]);
    if(query.includes('huellas:audit'))return sqlResponse(state.audit||[]);
    if(query.startsWith('INSERT INTO public.huellas_access'))return sqlResponse([]);
    throw new Error('Unexpected SQL operation in test');
  });
  return {state,queries,authCalls,management};
}
beforeEach(()=>{
  process.env.DATABASE_URL='postgresql://owner:test-only@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
  process.env.HUELLAS_ADMIN_EMAILS=person.email;
  for(const name of ['NEON_API_KEY','NEON_PROJECT_ID','NEON_BRANCH_ID','VERCEL'])delete process.env[name];
});

test('full names accept compound names, accents, apostrophes and hyphens; reject junk and lone words',()=>{
  for(const name of ['Ana Pérez','María de los Ángeles García','José Luis O’Connor','Jean-Luc D\'Angelo','李明 王芳','Álvaro Muñoz-Sáez'])assert(validFullName(name),name);
  assert.equal(normalizeFullName('  Mari\u0301a   Pe\u0301rez  '),'María Pérez');
  for(const name of ['',null,42,'Ana','123 456','--- !!!','Ana 123','Ana <script>','A B','Ana\nPérez','Ana\tPérez','Ana '+ 'a'.repeat(98)])assert.equal(validFullName(name),false,String(name));
});
test('server validates the full name before forwarding registration or consuming a rate limit',async t=>{
  const {queries,authCalls}=backend(t);
  for(const name of ['123 456','Ana','!@# !@#'])await reject(authProxy(request('/api/auth/sign-up/email',{name,email:person.email,password:'long-enough-password'}),config),'INVALID_NAME');
  assert.equal(queries.length,0);assert.equal(authCalls.length,0);
});
for(const status of ['pending','rejected','blocked']){
  test(`${status} accounts cannot retrieve classes, previews, users, metrics, audit or administrative actions`,async t=>{
    const {state,queries}=backend(t);state.member.status=status;
    const code='ACCOUNT_'+status.toUpperCase();
    await reject(lessonsEndpoint(request('/api/lessons'),config),code);
    await reject(lessonsEndpoint(request('/api/lessons?previewGroup=grande'),config),code);
    await reject(usersEndpoint(request('/api/users'),config),code);
    await reject(adminEndpoint(request('/api/admin'),config),code);
    await reject(adminEndpoint(request('/api/admin?view=audit'),config),code);
    await reject(adminEndpoint(request('/api/admin',command()),config),code);
    assert(queries.every(q=>q.query.includes('huellas:membership')));
    const data=await(await sessionEndpoint(request('/api/session'),config)).json();
    assert.equal(data.access.status,status);assert.equal(data.isAdmin,false);
  });
}
test('pending accounts can select their own group and record access, without receiving private lessons',async t=>{
  const {state,queries}=backend(t);state.member.status='pending';state.member.study_group=null;
  const data=await(await preferencesEndpoint(request('/api/preferences',{groupId:'intermedio'}),config)).json();
  assert.equal(data.groupId,'intermedio');assert.equal(data.access.status,'pending');assert.equal(data.study,null);
  await sessionEndpoint(request('/api/session',{}),config);
  assert(queries.some(q=>q.query.startsWith('INSERT INTO public.huellas_access')));
  const write=queries.find(q=>q.query.includes('huellas:own-group'));assert.deepEqual(write.params,[person.id,'intermedio']);
});
test('rejected and blocked users cannot change preferences or record protected access',async t=>{
  const {state,queries}=backend(t);
  for(const status of ['rejected','blocked']){
    state.member.status=status;
    await reject(preferencesEndpoint(request('/api/preferences',{groupId:'grande'}),config),'ACCOUNT_'+status.toUpperCase());
    await reject(sessionEndpoint(request('/api/session',{}),config),'ACCOUNT_'+status.toUpperCase());
  }
  assert(!queries.some(q=>q.query.includes('huellas:own-group')||q.query.startsWith('INSERT')));
});
test('deleted identities never regain access from a remaining session cookie',async t=>{
  const {state,queries}=backend(t);state.member=null;
  await reject(lessonsEndpoint(request('/api/lessons'),config),'ACCOUNT_UNAVAILABLE');
  assert(queries.some(q=>q.query.includes('huellas:initialize')&&q.query.includes("action = 'delete'")));
});
test('ordinary users cannot obtain administrative data even with an allowlisted email or forged browser headers',async t=>{
  backend(t);
  for(const [endpoint,path,body]of [[usersEndpoint,'/api/users'],[adminEndpoint,'/api/admin'],[adminEndpoint,'/api/admin?view=audit'],[adminEndpoint,'/api/admin',command('grant_admin')]]){
    await reject(endpoint(request(path,body,{'x-huellas-role':'owner','x-neon-auth-user-id':'owner'}),config),'FORBIDDEN');
  }
});
test('administrators cannot grant or revoke roles, permanently delete users or read owner audit',async t=>{
  const {state,queries,management}=backend(t);state.member.role='admin';
  for(const action of ['grant_admin','revoke_admin','delete'])await reject(adminEndpoint(request('/api/admin',command(action)),config),'FORBIDDEN');
  await reject(adminEndpoint(request('/api/admin?view=audit'),config),'FORBIDDEN');
  assert(!queries.some(q=>q.query.includes('huellas:action')));assert.equal(management.length,0);
});
test('administrative operations bind the actor to the authenticated ID and parameterize every value',async t=>{
  const {state,queries}=backend(t);state.member.role='owner';
  const target="u'); DROP TABLE example; --";
  await adminEndpoint(request('/api/admin',command('set_group',{userId:target,groupId:'grande'})),config);
  const action=queries.find(q=>q.query.includes('huellas:action'));
  assert.deepEqual(action.params,[person.id,target,'set_group','3','grande',null]);assert(!action.query.includes(target));
  await reject(adminEndpoint(request('/api/admin',command('approve',{actorId:'owner'})),config),'INVALID_ACTION');
  await reject(preferencesEndpoint(request('/api/preferences',{groupId:'grande',role:'owner'}),config),'INVALID_PREFERENCE');
});
test('confirmations, optimistic versions, group IDs and administrative payloads are checked on the server',async t=>{
  const {state,queries}=backend(t);state.member.role='owner';
  await reject(adminEndpoint(request('/api/admin',command('approve',{confirmed:false})),config),'CONFIRMATION_REQUIRED');
  for(const version of [-1,1.1,'3',2147483648])await reject(adminEndpoint(request('/api/admin',command('approve',{version})),config),'INVALID_ACTION');
  await reject(adminEndpoint(request('/api/admin',command('set_group',{groupId:'adultos'})),config),'INVALID_GROUP');
  await reject(adminEndpoint(request('/api/admin',command('approve',{groupId:'grande'})),config),'INVALID_ACTION');
  await reject(adminEndpoint(request('/api/admin',command('delete')),config),'CONFIRMATION_REQUIRED');
  assert(!queries.some(q=>q.query.includes('huellas:action')));
});
test('SQL authority rejects stale lists, unverified targets, owner changes and revoked actors',async t=>{
  const {state}=backend(t);state.member.role='owner';
  for(const code of ['STALE_USER','EMAIL_NOT_VERIFIED','OWNER_PROTECTED','FORBIDDEN','DELETION_PENDING']){
    state.actionError='HUELLAS_'+code;
    await reject(adminEndpoint(request('/api/admin',command()),config),code);
  }
});
test('role revocation and blocking take effect on the next request with the same session and signed cache',async t=>{
  const {state,authCalls}=backend(t);state.member.role='admin';
  const initial=await sessionEndpoint(request('/api/session'),config);
  const jar=`${TOKEN}=test-session; `+initial.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  await usersEndpoint(request('/api/users',undefined,{Cookie:jar}),config);
  state.member.role='user';
  await reject(usersEndpoint(request('/api/users',undefined,{Cookie:jar}),config),'FORBIDDEN');
  state.member.status='blocked';
  await reject(lessonsEndpoint(request('/api/lessons',undefined,{Cookie:jar}),config),'ACCOUNT_BLOCKED');
  assert.equal(authCalls.length,4,'every protected request revalidates the provider session');
});
test('unverified administrators cannot use administrative endpoints',async t=>{
  const {state}=backend(t);state.member.role='owner';state.user.emailVerified=false;
  await reject(adminEndpoint(request('/api/admin',command()),config),'EMAIL_NOT_VERIFIED');
});
test('administrator metrics and audit come from SQL, remain private and paginate audit IDs safely',async t=>{
  const {state,queries}=backend(t);state.member.role='owner';
  const response=await adminEndpoint(request('/api/admin?view=overview'),config);
  const data=await response.json();assert.equal(data.metrics.total,'3');assert.equal(data.deletionEnabled,false);assert.match(response.headers.get('cache-control'),/private, no-store/);
  await adminEndpoint(request('/api/admin?view=audit&before=50'),config);
  assert.deepEqual(queries.at(-1).params,['50','50']);
  await reject(adminEndpoint(request('/api/admin?view=audit&before=0%20OR%201=1'),config),'INVALID_PAGE');
});
test('directory status, role, search and sorting filters cannot inject SQL',async t=>{
  const {state,queries}=backend(t);state.member.role='admin';
  const search="O'Connor % _";
  await usersEndpoint(request('/api/users?status=pending&role=user&sort=last_seen_desc&search='+encodeURIComponent(search)),config);
  const q=queries.at(-1);assert(q.params.includes(search));assert(!q.query.includes(search));assert.match(q.query,/position\(lower/);
  for(const query of ['status=owner','role=root','sort=DROP%20TABLE','search='+'a'.repeat(161)])await assert.rejects(usersEndpoint(request('/api/users?'+query),config),error=>error.status===400);
});
test('origin protection covers both administrative reads and writes',async t=>{
  const {queries}=backend(t);
  await reject(adminEndpoint(request('/api/admin',command(),{Origin:'https://evil.example'}),config),'INVALID_ORIGIN');
  await reject(usersEndpoint(request('/api/users',undefined,{'Sec-Fetch-Site':'cross-site'}),config),'INVALID_ORIGIN');
  const input=request('/api/admin',command());input.headers.delete('Origin');
  await reject(adminEndpoint(input,config),'INVALID_ORIGIN');assert.equal(queries.length,0);
});
test('distributed limits stop repeated authentication and mutations; logout remains available',async t=>{
  const {state,queries,authCalls}=backend(t);state.member.role='owner';state.allowed=false;
  await reject(authProxy(request('/api/auth/sign-in/email',{email:person.email,password:'test-password'}),config),'TOO_MANY_REQUESTS');
  assert.equal(authCalls.length,0);
  const limit=queries[0];assert.match(limit.params[0],/^[a-f0-9]{64}$/);assert(!JSON.stringify(limit).includes(person.email));
  await reject(adminEndpoint(request('/api/admin',command()),config),'TOO_MANY_REQUESTS');
  assert(!queries.some(q=>q.query.includes('huellas:action')));
  assert.equal((await authProxy(request('/api/auth/sign-out',{}),config)).status,200);
});
test('Node bridge ignores forged internal IP headers and obtains the local address from the connection',async()=>{
  const input={method:'POST',url:'/api/auth/sign-out',body:{},headers:{origin,'content-type':'application/json','x-huellas-client-ip':'forged','x-huellas-role':'owner','x-vercel-forwarded-for':'spoofed'},socket:{remoteAddress:'127.0.0.2'}};
  const result=await fromNode(input,config);
  assert.equal(result.headers.get('x-huellas-client-ip'),'127.0.0.2');assert.equal(result.headers.has('x-huellas-role'),false);
});
test('identity deletion fails before blocking anyone when administrative Neon configuration is absent or mismatched',async t=>{
  const {state,queries,management}=backend(t);state.member.role='owner';
  await reject(adminEndpoint(request('/api/admin',command('delete',{confirmation:'target@example.com'})),config),'DELETE_NOT_CONFIGURED');
  assert.equal(management.length,0);
  process.env.NEON_API_KEY='test-private-key';process.env.NEON_PROJECT_ID='test-project';process.env.NEON_BRANCH_ID='br-test';
  state.integration={base_url:'https://another-auth.example/neondb/auth'};
  await reject(adminEndpoint(request('/api/admin',command('delete',{confirmation:'target@example.com'})),config),'DELETE_CONFIGURATION_MISMATCH');
  assert(!queries.some(q=>q.query.includes('huellas:action')));assert.equal(management.length,1);
});
test('owner deletion uses the supported provider API, then confirms absence before transactional app cleanup',async t=>{
  const {state,queries,management}=backend(t);state.member.role='owner';
  process.env.NEON_API_KEY='test-private-key';process.env.NEON_PROJECT_ID='test-project';process.env.NEON_BRANCH_ID='br-test';
  await adminEndpoint(request('/api/admin',command('delete',{confirmation:'target@example.com'})),config);
  assert.equal(management.length,2);assert.equal(management[1].init.method,'DELETE');
  assert.equal(management[1].url,'https://console.neon.tech/api/v2/projects/test-project/branches/br-test/auth/users/target-user');
  assert.equal(management[1].init.redirect,'error');
  const finish=queries.find(q=>q.query.includes('huellas:finish-delete'));assert.equal(finish.params.at(-1),'true');
  assert(queries.findIndex(q=>q.query.includes('huellas:identity-exists'))<queries.indexOf(finish));
  assert(!queries.some(q=>/(INSERT INTO|UPDATE|DELETE FROM)\s+neon_auth/i.test(q.query)));
});
test('failed or unconfirmed provider deletion retains the blocked operation and records failure for explicit retry',async t=>{
  const {state,queries}=backend(t);state.member.role='owner';
  process.env.NEON_API_KEY='test-private-key';process.env.NEON_PROJECT_ID='test-project';process.env.NEON_BRANCH_ID='br-test';
  state.deleteStatus=503;
  await reject(adminEndpoint(request('/api/admin',command('delete',{confirmation:'target@example.com'})),config),'DELETE_INCOMPLETE');
  assert.equal(queries.findLast(q=>q.query.includes('huellas:finish-delete')).params.at(-1),'false');
  state.deleteStatus=404;state.identityPresent=true;
  await reject(adminEndpoint(request('/api/admin',command('delete',{confirmation:'target@example.com'})),config),'DELETE_INCOMPLETE');
  assert.equal(queries.filter(q=>q.query.includes('huellas:finish-delete')).length,2);
  assert(!queries.some(q=>q.query.includes('huellas:finish-delete')&&q.params.at(-1)==='true'));
});

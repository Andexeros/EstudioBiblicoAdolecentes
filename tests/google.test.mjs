import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {NEON_AUTH_SESSION_COOKIE_NAME as TOKEN} from '@neondatabase/auth/server';
import {sessionEndpoint,profileEndpoint,preferencesEndpoint,lessonsEndpoint,usersEndpoint,adminEndpoint} from '../server/api.js';
import {authProxy} from '../server/auth.js';
import {HttpError} from '../server/http.js';

const origin='https://huellas.example',baseUrl='https://auth.example/neondb/auth';
const config={origin,baseUrl,cookieSecret:'google-test-only-secret-01234567890123456789',sessionDataTtl:60,sameSite:'lax'};
const time=new Date().toISOString();
const req=(path,body,headers={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:`${TOKEN}=test-session`,...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const denied=(promise,code)=>assert.rejects(promise,error=>error instanceof HttpError&&error.code===code);
function result(rows){const names=Object.keys(rows[0]||{}),types=names.map(name=>typeof rows[0]?.[name]==='boolean'?16:typeof rows[0]?.[name]==='object'&&rows[0]?.[name]!==null?3802:25);return Response.json({fields:names.map((name,i)=>({name,dataTypeID:types[i]})),rows:rows.map(row=>names.map((name,i)=>row[name]==null?null:types[i]===16?(row[name]?'t':'f'):types[i]===3802?JSON.stringify(row[name]):String(row[name]))),rowCount:rows.length,command:'SELECT'});}
function backend(t){
 const state={user:{id:'same-user-id',email:'ana@example.com',name:'Google Alias',emailVerified:true,createdAt:time,updatedAt:time},member:{user_id:'same-user-id',google_account:true,status:'pending',role:'user',version:1,study_group:null,full_name:null,name_confirmed_at:null},allowed:true,updateStatus:200,sqlError:null};
 const calls=[],queries=[];
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const body=init.body?JSON.parse(init.body):undefined;url=String(url);
  if(url.startsWith(baseUrl)){
   calls.push({url,body,init});
   if(url.endsWith('/get-session'))return Response.json(state.user?{user:state.user,session:{id:'s',token:'test-session',userId:state.user.id,createdAt:time,updatedAt:time,expiresAt:new Date(Date.now()+3600000).toISOString()}}:null);
   if(url.endsWith('/update-user')){if(state.updateStatus!==200)return Response.json({message:'private provider detail',token:'do-not-expose'},{status:state.updateStatus});state.user.name=body.name;return Response.json({status:true},{headers:{'Set-Cookie':`${TOKEN}=test-session; Path=/; HttpOnly; Secure; SameSite=Lax`}});}
   return Response.json(state.socialResponse || {url:'https://accounts.google.com/o/oauth2/v2/auth?state=test',redirect:true});
  }
  const{query,params}=body;queries.push({query,params});
  if(query.includes('huellas:membership'))return result(state.member?[state.member]:[]);
  if(query.includes('huellas:initialize'))return result([]);
  if(query.includes('huellas:limit'))return result([{allowed:state.allowed}]);
  if(query.includes('huellas:confirm-name')){if(state.sqlError)return Response.json({message:state.sqlError,code:'P0001'},{status:400});state.member.full_name=params[1];state.member.name_confirmed_at=time;state.member.version++;return result([]);}
  if(query.includes('huellas:action'))return Response.json({message:'HUELLAS_PROFILE_REQUIRED',code:'P0001'},{status:400});
  if(query.includes('huellas:users'))return result([]);
  if(query.startsWith('INSERT INTO public.huellas_access'))return result([]);
  throw new Error('Unexpected SQL operation in Google test');
 });return{state,calls,queries};
}
beforeEach(()=>{process.env.DATABASE_URL='postgresql://owner:test-only@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require';process.env.HUELLAS_GOOGLE_ENABLED='true';});

test('Google feature flag controls availability without replacing password authentication',async t=>{
 const{state}=backend(t);process.env.HUELLAS_GOOGLE_ENABLED='false';
 assert.equal((await(await sessionEndpoint(req('/api/session'),config)).json()).googleEnabled,false);
 await denied(authProxy(req('/api/auth/sign-in/social',{provider:'google'}),config),'GOOGLE_NOT_ENABLED');
 state.user=null;assert.equal((await authProxy(req('/api/auth/sign-in/email',{email:'ana@example.com',password:'test-password'}),config)).status,200);
});
test('OAuth initiation fixes the provider and local callbacks, strips tokens and preserves class route',async t=>{
 const{calls}=backend(t);
 await authProxy(req('/api/auth/sign-in/social',{provider:'attacker',returnHash:'#rut/claves',callbackURL:'https://evil.example',newUserCallbackURL:'https://evil.example',idToken:{token:'fake'},role:'owner'}),config);
 const sent=calls.find(c=>c.url.endsWith('/sign-in/social'));
 assert.equal(sent.body.provider,'google');assert.equal(sent.body.idToken,undefined);assert.equal(sent.body.role,undefined);
 assert.equal(sent.body.callbackURL,origin+'/api/auth-return?next=%23rut%2Fclaves');assert.equal(sent.body.newUserCallbackURL,sent.body.callbackURL);assert.equal(sent.body.errorCallbackURL,origin+'/?auth=error');
});

test('Neon intermediate OAuth URL and temporary token are preserved with the configured auth origin',async t=>{
 const{state}=backend(t);
 const url=baseUrl+'/sign-in/social/init?token=test-only.a%2Bb%2Fc%3D&state=keep%20this';
 state.socialResponse={url,authOrigin:'https://attacker.example',token:'never-expose',redirect:true};
 const response=await authProxy(req('/api/auth/sign-in/social',{returnHash:'#rut/claves',authOrigin:'https://attacker.example'}),config);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{url,authOrigin:new URL(baseUrl).origin});
 assert.match(response.headers.get('cache-control'),/private, no-store/);
});

test('OAuth redirect validation rejects non-HTTPS, foreign origins, credentials, ports and missing URLs',async t=>{
 const{state}=backend(t);
 for(const url of [undefined,null,42,'','/relative','javascript:alert(1)','http://auth.example/neondb/auth/sign-in/social/init',
  'https://auth.example.attacker.example/init','https://another-branch.example/init','https://auth.example:8443/init',
  'https://user:password@auth.example/init','https://auth.example@attacker.example/init','https://accounts.google.com:8443/auth']){
  state.socialResponse={url};
  await denied(authProxy(req('/api/auth/sign-in/social',{}),config),'INVALID_OAUTH_REDIRECT');
 }
});

// Exercise the actual button listener without a browser or extra test dependencies.
const authSource=await readFile(new URL('../auth.js',import.meta.url),'utf8');
const listenerStart=authSource.indexOf("$('auth-google-button').addEventListener('click'");
const listenerEnd=authSource.indexOf('\n\nfunction bindDialog',listenerStart);
assert(listenerStart>=0&&listenerEnd>listenerStart);
const listenerSource=authSource.slice(listenerStart,listenerEnd);
function googleButton(response){
 let click;
 const navigations=[],messages=[],requests=[];
 const context={URL,busy:false,googleEnabled:true,
  $:id=>{assert.equal(id,'auth-google-button');return{addEventListener(type,handler){assert.equal(type,'click');click=handler;}};},
  location:{hash:'#rut/claves',assign:url=>navigations.push(url)},
  window:{open(){assert.fail('OAuth must use the same tab, including after an asynchronous response');}},
  message:(text,error=false)=>messages.push({text,error}),errorText:error=>error.message,
  setBusy:value=>{context.busy=value;},
  request:async(path,body)=>{requests.push({path,body});return typeof response==='function'?response():response;},
 };
 runInNewContext(listenerSource,context);
 return{click,navigations,messages,requests,context};
}

test('Google button follows the asynchronous Neon URL in the same tab without changing its token',async()=>{
 const url=baseUrl+'/sign-in/social/init?token=test-only.a%2Bb%2Fc%3D&state=keep%20this';
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const button=googleButton(()=>pending);
 const first=button.click();
 await button.click();
 assert.equal(button.requests.length,1);assert.equal(button.navigations.length,0);assert.equal(button.context.busy,true);
 release({url,authOrigin:new URL(baseUrl).origin});
 await first;
 assert.deepEqual(button.navigations,[url]);
 assert.equal(button.requests[0].path,'/api/auth/sign-in/social');
 assert.equal(button.requests[0].body.returnHash,'#rut/claves');
 assert.deepEqual(Object.keys(button.requests[0].body),['returnHash']);
 assert(!button.messages.some(item=>item.error));
});

test('Google button still accepts direct Google authorization responses',async()=>{
 const url='https://accounts.google.com/o/oauth2/v2/auth?state=test-only';
 const button=googleButton({url});await button.click();assert.deepEqual(button.navigations,[url]);
});

test('Google button refuses unexpected destinations and restores the retry state',async()=>{
 for(const data of [
  {url:'https://attacker.example/init',authOrigin:new URL(baseUrl).origin},
  {url:baseUrl+'/sign-in/social/init?token=test-only'},
  {url:'http://auth.example/init',authOrigin:'http://auth.example'},
  {url:'https://user:password@auth.example/init',authOrigin:new URL(baseUrl).origin},
  {url:'https://auth.example:8443/init',authOrigin:new URL(baseUrl).origin},
  {url:'https://accounts.google.com:8443/auth'},
 ]){
  const button=googleButton(data);await button.click();assert.equal(button.navigations.length,0);
  assert.equal(button.context.busy,false);assert.equal(button.messages.at(-1).error,true);
 }
 const failed=googleButton(()=>{throw new Error('Conexión interrumpida');});await failed.click();
 assert.equal(failed.context.busy,false);assert.equal(failed.navigations.length,0);assert.equal(failed.messages.at(-1).error,true);
});
test('Google account discovery uses an authenticated ID and a read-only account query',async t=>{
 const{queries}=backend(t);const response=await(await sessionEndpoint(req('/api/session'),config)).json();
 assert.equal(response.access.needsNameConfirmation,true);assert.equal(response.access.status,'pending');assert.equal(response.isAdmin,false);
 const q=queries[0];assert.match(q.query,/neon_auth\."account"/);assert.match(q.query,/"providerId" = 'google'/);assert.deepEqual(q.params,['same-user-id']);assert(!/accessToken|refreshToken/.test(q.query));
});
test('unconfirmed Google names cannot skip onboarding by requesting preferences, classes, or admin endpoints',async t=>{
 const{state}=backend(t);await denied(preferencesEndpoint(req('/api/preferences'),config),'PROFILE_REQUIRED');
 await denied(preferencesEndpoint(req('/api/preferences',{groupId:'grande'}),config),'PROFILE_REQUIRED');
 await denied(lessonsEndpoint(req('/api/lessons'),config),'ACCOUNT_PENDING');
 state.member.status='approved';state.member.role='owner';state.member.study_group='adolescentes';
 for(const[fn,path]of [[lessonsEndpoint,'/api/lessons'],[usersEndpoint,'/api/users'],[adminEndpoint,'/api/admin']])await denied(fn(req(path),config),'PROFILE_REQUIRED');
});
test('confirming a Google name only updates that identity and its own application profile',async t=>{
 const{state,calls,queries}=backend(t);
 const response=await profileEndpoint(req('/api/profile',{name:'  María  del Carmen O’Connor '}),config);
 assert.deepEqual(await response.json(),{ok:true});assert.match(response.headers.get('cache-control'),/private, no-store/);
 const update=calls.find(c=>c.url.endsWith('/update-user'));assert.deepEqual(update.body,{name:'María del Carmen O’Connor'});
 const write=queries.find(q=>q.query.includes('huellas:confirm-name'));assert.deepEqual(write.params,['same-user-id','María del Carmen O’Connor']);
 assert.equal(state.member.status,'pending');assert.equal(state.member.role,'user');assert.equal(state.member.study_group,null);
 assert(!queries.some(q=>/(INSERT INTO|UPDATE|DELETE FROM)\s+neon_auth/i.test(q.query)));
 assert(response.headers.getSetCookie().some(c=>/HttpOnly/.test(c)));
});
test('confirmed names persist in session data even if a later Google profile contains a different alias',async t=>{
 const{state}=backend(t);await profileEndpoint(req('/api/profile',{name:'Ana María Pérez'}),config);state.user.name='Changed Google nickname';
 const data=await(await sessionEndpoint(req('/api/session'),config)).json();assert.equal(data.user.name,'Ana María Pérez');assert.equal(data.access.needsNameConfirmation,false);assert.equal(data.access.status,'pending');
 assert.equal((await(await preferencesEndpoint(req('/api/preferences'),config)).json()).study,null);
});
test('an existing linked owner keeps their ID, role, approval and group after confirming the name',async t=>{
 const{state}=backend(t);state.member.role='owner';state.member.status='approved';state.member.study_group='adolescentes';
 await profileEndpoint(req('/api/profile',{name:'Andrés Abel Pravata'}),config);
 const data=await(await sessionEndpoint(req('/api/session'),config)).json();assert.equal(data.user.id,'same-user-id');assert.equal(data.access.role,'owner');assert.equal(data.access.status,'approved');assert.equal(data.access.groupId,'adolescentes');assert.equal(data.isAdmin,true);
 assert.equal((await(await lessonsEndpoint(req('/api/lessons'),config)).json()).lessons.length,15);
});
test('anonymous and unverified sessions cannot confirm a name',async t=>{
 const{state,calls,queries}=backend(t);state.user=null;await denied(profileEndpoint(req('/api/profile',{name:'Ana Pérez'}),config),'UNAUTHENTICATED');
 state.user={id:'same-user-id',email:'ana@example.com',name:'Ana',emailVerified:false};await denied(profileEndpoint(req('/api/profile',{name:'Ana Pérez'}),config),'EMAIL_NOT_VERIFIED');
 assert(!calls.some(c=>c.url.endsWith('/update-user')));assert.equal(queries.length,0);
});
test('blocked and rejected accounts cannot use profile confirmation to reactivate themselves',async t=>{
 const{state,calls}=backend(t);for(const status of ['blocked','rejected']){state.member.status=status;await denied(profileEndpoint(req('/api/profile',{name:'Ana Pérez'}),config),'ACCOUNT_'+status.toUpperCase());}
 assert(!calls.some(c=>c.url.endsWith('/update-user')));
});
test('full-name validation runs before either identity or profile mutation',async t=>{
 const{calls,queries}=backend(t);for(const name of ['Ana','123 456','<script> Name','Ana '+ 'x'.repeat(100)])await denied(profileEndpoint(req('/api/profile',{name}),config),'INVALID_NAME');
 assert(!calls.some(c=>c.url.endsWith('/update-user')));assert(!queries.some(q=>q.query.includes('huellas:confirm-name')));
});
test('profile endpoint rejects other-user IDs, roles, approval and verification fields',async t=>{
 const{calls}=backend(t);for(const field of ['userId','email','role','status','emailVerified','name_confirmed_at'])await denied(profileEndpoint(req('/api/profile',{name:'Ana Pérez',[field]:'injected'}),config),'INVALID_PROFILE');
 assert(!calls.some(c=>c.url.endsWith('/update-user')));
});
test('client claims cannot make a password-only account appear to have a Google identity',async t=>{
 const{state,calls}=backend(t);state.member.google_account=false;
 await denied(profileEndpoint(req('/api/profile?provider=google',{name:'Ana Pérez'},{'x-huellas-provider':'google'}),config),'PROFILE_NOT_REQUIRED');
 assert(!calls.some(c=>c.url.endsWith('/update-user')));
});
test('confirmation retries are idempotent and cannot silently change an already confirmed name',async t=>{
 const{calls,queries}=backend(t);await profileEndpoint(req('/api/profile',{name:'Ana Pérez'}),config);await profileEndpoint(req('/api/profile',{name:'Ana Pérez'}),config);
 await denied(profileEndpoint(req('/api/profile',{name:'Otra Persona'}),config),'PROFILE_CONFIRMED');
 assert.equal(calls.filter(c=>c.url.endsWith('/update-user')).length,1);assert.equal(queries.filter(q=>q.query.includes('huellas:confirm-name')).length,1);
});
test('provider failure never marks a name confirmed or exposes provider details',async t=>{
 const{state,queries}=backend(t);state.updateStatus=503;
 await assert.rejects(profileEndpoint(req('/api/profile',{name:'Ana Pérez'}),config),error=>error.code==='PROFILE_UPDATE_FAILED'&&!/private|token/.test(error.message));
 assert(!queries.some(q=>q.query.includes('huellas:confirm-name')));assert.equal(state.member.status,'pending');assert.equal(state.member.name_confirmed_at,null);
});
test('a concurrent blocking decision wins over profile saving and does not release private classes',async t=>{
 const{state}=backend(t);state.sqlError='HUELLAS_ACCESS_DENIED';await denied(profileEndpoint(req('/api/profile',{name:'Ana Pérez'}),config),'ACCOUNT_BLOCKED');
 assert.equal(state.member.name_confirmed_at,null);assert.equal(state.member.status,'pending');await denied(lessonsEndpoint(req('/api/lessons'),config),'ACCOUNT_PENDING');
});
test('profile confirmation has rate and origin protection and only accepts POST',async t=>{
 const{state,calls}=backend(t);
 await denied(profileEndpoint(req('/api/profile'),config),'METHOD_NOT_ALLOWED');
 await denied(profileEndpoint(req('/api/profile',{name:'Ana Pérez'},{Origin:'https://evil.example'}),config),'INVALID_ORIGIN');
 state.allowed=false;await denied(profileEndpoint(req('/api/profile',{name:'Ana Pérez'}),config),'TOO_MANY_REQUESTS');assert(!calls.some(c=>c.url.endsWith('/update-user')));
});
test('administrators cannot approve an unconfirmed Google applicant through a handcrafted API call',async t=>{
 const{state}=backend(t);state.member.google_account=false;state.member.role='owner';state.member.status='approved';
 await denied(adminEndpoint(req('/api/admin',{action:'approve',userId:'google-applicant',version:1,confirmed:true}),config),'PROFILE_REQUIRED');
});

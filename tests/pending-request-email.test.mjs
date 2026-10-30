import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { NEON_AUTH_SESSION_COOKIE_NAME as TOKEN } from '@neondatabase/auth/server';
import { notifyPendingRequest, sendPendingRequestSMTP } from '../server/pending-request-email.js';
import { pendingRequestEmailTemplate, OWNER_NOTIFICATION_EMAIL, ADMIN_REVIEW_URL, PENDING_REQUEST_SUBJECT } from '../server/pending-request-email-template.js';
import { LOGO_CID } from '../server/approval-email-template.js';
import { preferencesEndpoint, sessionEndpoint, adminEndpoint } from '../server/api.js';
import { authProxy, safeHash } from '../server/auth.js';

const origin='https://huellas.example',baseUrl='https://auth.example/neondb/auth';
const config={origin,baseUrl,cookieSecret:'test-secret-only-012345678901234567890',sessionDataTtl:60,sameSite:'lax'};
const time=new Date().toISOString();
const applicant={id:'applicant',name:'María Pérez',email:'applicant@example.com',emailVerified:true,createdAt:time,updatedAt:time};
const member={user_id:applicant.id,status:'pending',role:'user',version:2,study_group:'intermedio',google_account:false};
const notification={status:'claimed',id:'db5a12e2-6d21-40da-917d-06a3a12a45b7',attemptId:'f20bf2a5-304c-42f3-aeef-f93536a43782',applicantEmail:applicant.email,name:applicant.name,groupId:'intermedio'};
const request=(path,body)=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:`${TOKEN}=test-session`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
function sqlResponse(rows){
  const names=Object.keys(rows[0]||{}),types=names.map(name=>typeof rows[0]?.[name]==='boolean'?16:typeof rows[0]?.[name]==='object'?3802:25);
  return Response.json({fields:names.map((name,i)=>({name,dataTypeID:types[i]})),rows:rows.map(row=>names.map((name,i)=>row[name]==null?null:types[i]===16?(row[name]?'t':'f'):types[i]===3802?JSON.stringify(row[name]):String(row[name]))),rowCount:rows.length,command:'SELECT'});
}
function backend(t,overrides={}){
  const state={user:{...applicant},member:{...member},claimed:false,saved:true,notification:{...notification},...overrides},queries=[];
  t.mock.method(globalThis,'fetch',async(url,init={})=>{
    if(String(url).startsWith(baseUrl)){
      if(!String(url).includes('get-session'))return Response.json({status:true});
      return Response.json(state.user?{user:state.user,session:{id:'session',userId:state.user.id,token:'test-session',createdAt:time,updatedAt:time,expiresAt:new Date(Date.now()+3600000).toISOString()}}:null);
    }
    const {query,params}=JSON.parse(init.body);queries.push({query,params});
    if(query.includes('huellas:membership'))return sqlResponse([state.member]);
    if(query.includes('huellas:limit'))return sqlResponse([{allowed:true}]);
    if(query.includes('huellas:own-group')){state.member.study_group=params[1];state.member.version++;state.groupCommitted=true;return sqlResponse([]);}
    if(query.startsWith('INSERT INTO public.huellas_access'))return sqlResponse([]);
    if(query.includes('huellas:pending-request-email-claim')){
      if(state.claimError)throw new Error('private database error');
      if(state.claimed)return sqlResponse([{result:{status:'unchanged'}}]);
      if(state.notification.status==='claimed')state.claimed=true;
      return sqlResponse([{result:state.notification}]);
    }
    if(query.includes('huellas:pending-request-email-finish')){
      if(state.finishError)throw new Error('private database error');
      return sqlResponse([{saved:state.saved}]);
    }
    throw new Error('Unexpected SQL operation');
  });
  return {state,queries};
}
function smtp(t,handler){
  const calls=[],options=[];
  t.mock.method(nodemailer,'createTransport',value=>{
    options.push(value);
    return {close(){},async sendMail(message){calls.push(message);return handler?handler(message):{accepted:[OWNER_NOTIFICATION_EMAIL],messageId:message.messageId};}};
  });
  return {calls,options};
}
beforeEach(()=>{
  process.env.DATABASE_URL='postgresql://owner:test-only@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
  process.env.HUELLAS_SMTP_HOST='smtp.gmail.com';process.env.HUELLAS_SMTP_PORT='465';
  process.env.HUELLAS_SMTP_USER=OWNER_NOTIFICATION_EMAIL;process.env.HUELLAS_SMTP_FROM=OWNER_NOTIFICATION_EMAIL;
  process.env.HUELLAS_SMTP_PASSWORD='private-test-only';
});

test('pending email contains the actual applicant and group, safe HTML and one fixed administrative link',()=>{
  for(const[groupId,label]of [['adolescentes','Adolescentes'],['intermedio','Grupo Intermedio'],['grande','Grupo Grande']]){
    const result=pendingRequestEmailTemplate({...notification,groupId,name:'María <img src=x onerror=alert(1)> & Pérez'});
    assert.equal(result.subject,PENDING_REQUEST_SUBJECT);assert(result.text.includes(label));assert(result.text.includes(applicant.email));
    assert(result.html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; Pérez'));assert(!result.html.includes('<img src=x'));
    assert(result.html.includes('Revisar solicitud'));assert(result.html.includes('src="cid:'+LOGO_CID+'"'));
    assert(result.html.includes('max-width:560px'));assert(result.html.includes('#9cdbf4'));
    for(const link of result.html.matchAll(/href="([^"]+)"/g))assert.equal(link[1],ADMIN_REVIEW_URL);
    assert(!/<script\b|<svg\b|url\(/i.test(result.html));
  }
});
test('the existing Gmail TLS configuration sends to the owner even when sender and recipient match',async t=>{
  const {calls,options}=smtp(t);await sendPendingRequestSMTP({...notification,email:'attacker@example.com'});
  assert.equal(calls.length,1);assert.deepEqual(calls[0].to,{address:OWNER_NOTIFICATION_EMAIL});
  assert.equal(calls[0].from.address,OWNER_NOTIFICATION_EMAIL);assert.equal(options[0].host,'smtp.gmail.com');
  assert.equal(options[0].port,465);assert.equal(options[0].secure,true);assert.equal(options[0].tls.rejectUnauthorized,true);
  assert(calls[0].text.includes(applicant.email));assert(calls[0].messageId.includes('huellas-pending-request.'));
  assert.equal(calls[0].attachments[0].cid,LOGO_CID);assert(Buffer.isBuffer(calls[0].attachments[0].content));
  assert(!JSON.stringify(calls[0]).includes(process.env.HUELLAS_SMTP_PASSWORD));
});
test('the new email compiles as MIME with text, HTML and an embedded Bible without contacting Gmail',async t=>{
  const original=nodemailer.createTransport,transport=original({streamTransport:true,buffer:true});let mime;
  smtp(t,async message=>{mime=(await transport.sendMail(message)).message.toString();return {accepted:[OWNER_NOTIFICATION_EMAIL],messageId:message.messageId};});
  await sendPendingRequestSMTP(notification);
  assert.match(mime,/multipart\/alternative/);assert.match(mime,/multipart\/related/);
  assert.match(mime,/Content-Type: text\/html; charset=utf-8/i);assert(mime.includes('Content-ID: <'+LOGO_CID+'>'));
});
test('unverified, incomplete, invalid-name, unconfirmed Google and restricted accounts do not even claim an email',async t=>{
  const {queries}=backend(t);let sends=0;
  const cases=[
    [{...applicant,emailVerified:false},member],
    [applicant,{...member,study_group:null}],
    [applicant,{...member,study_group:'inventado'}],
    [applicant,{...member,google_account:true,name_confirmed_at:null}],
    [{...applicant,name:'123 456'},member],
    [applicant,{...member,status:'approved'}],[applicant,{...member,status:'blocked'}],
    [applicant,{...member,status:'rejected'}],[applicant,{...member,deletion_id:'deleting'}],
    [applicant,{...member,user_id:'another-user'}],
  ];
  for(const[user,m]of cases)assert.deepEqual(await notifyPendingRequest(user,m,{send:async()=>{sends++;}}),{status:'not_applicable'});
  assert.equal(sends,0);assert.equal(queries.length,0);
});
test('the atomic claim and final acceptance use only parameterized, authenticated identity',async t=>{
  const {queries}=backend(t);let sends=0;
  const result=await notifyPendingRequest(applicant,member,{send:async data=>{sends++;assert.deepEqual(data,notification);return {messageId:'accepted-id'};}});
  assert.deepEqual(result,{status:'sent'});assert.equal(sends,1);assert.deepEqual(queries[0].params,[applicant.id]);
  assert.deepEqual(queries[1].params,[notification.id,notification.attemptId,'sent','accepted-id',null]);
  assert(queries.every(q=>!q.query.includes(applicant.email)));
});
test('simultaneous requests, later sessions and group changes send only once',async t=>{
  backend(t);let sends=0;
  const options={send:async()=>{sends++;return {messageId:'once'};}};
  const results=await Promise.all([notifyPendingRequest(applicant,member,options),notifyPendingRequest(applicant,member,options)]);
  await notifyPendingRequest(applicant,{...member,study_group:'grande'},options);
  assert.equal(sends,1);assert(results.some(r=>r.status==='sent'));assert(results.some(r=>r.status==='unchanged'));
});
test('claim storage failure never prevents onboarding and logs no error details',async t=>{
  backend(t,{claimError:true});const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args.join(' ')));
  assert.deepEqual(await notifyPendingRequest(applicant,member),{status:'unavailable'});
  assert.deepEqual(logs,['Huellas pending request email: NOTIFICATION_UNAVAILABLE']);
});
test('lost final acknowledgment never automatically repeats an accepted message',async t=>{
  backend(t,{finishError:true});t.mock.method(console,'error',()=>{});let sends=0;
  const options={send:async()=>{sends++;return {messageId:'accepted'};}};
  assert.deepEqual(await notifyPendingRequest(applicant,member,options),{status:'uncertain'});
  await notifyPendingRequest(applicant,member,options);assert.equal(sends,1);
});
test('a failed SMTP send keeps registration, chosen group and pending approval intact',async t=>{
  const {state,queries}=backend(t,{member:{...member,study_group:null}});const logs=[];
  t.mock.method(console,'error',(...args)=>logs.push(args.join(' ')));
  const {calls}=smtp(t,()=>{assert(state.groupCommitted);throw Object.assign(new Error('private SMTP response'),{code:'EAUTH'});});
  const result=await(await preferencesEndpoint(request('/api/preferences',{groupId:'intermedio'}),config)).json();
  assert.equal(result.groupId,'intermedio');assert.equal(result.access.status,'pending');assert.equal(result.study,null);
  assert.equal(state.member.status,'pending');assert.equal(calls.length,1);
  assert.equal(queries.find(q=>q.query.includes('pending-request-email-finish')).params.at(-1),'SMTP_AUTH_FAILED');
  assert.deepEqual(logs,['Huellas pending request email: SMTP_AUTH_FAILED']);
  await sessionEndpoint(request('/api/session',{}),config);assert.equal(calls.length,1);
});
test('saving the first group waits for SMTP acceptance and exposes no notification or credentials to the applicant',async t=>{
  const {state,queries}=backend(t,{member:{...member,study_group:null}});let release,reached;
  const started=new Promise(resolve=>{reached=resolve;});
  smtp(t,async()=>{assert(state.groupCommitted);reached();await new Promise(resolve=>{release=resolve;});return {accepted:[OWNER_NOTIFICATION_EMAIL],messageId:'accepted'};});
  let finished=false;const pending=preferencesEndpoint(request('/api/preferences',{groupId:'intermedio'}),config).then(response=>{finished=true;return response;});
  await started;assert.equal(finished,false);release();const response=await pending,data=await response.json();
  assert.equal(response.status,200);assert.equal(data.access.status,'pending');assert.equal(data.study,null);
  assert.equal(data.notification,undefined);assert(!JSON.stringify(data).includes(OWNER_NOTIFICATION_EMAIL));
  assert(queries.findIndex(q=>q.query.includes('own-group'))<queries.findIndex(q=>q.query.includes('pending-request-email-claim')));
});
test('preference reads, unverified users and injected recipient/user IDs do not send',async t=>{
  const {state,queries}=backend(t);const {calls}=smtp(t);
  await preferencesEndpoint(request('/api/preferences'),config);assert.equal(calls.length,0);
  await assert.rejects(preferencesEndpoint(request('/api/preferences',{groupId:'intermedio',email:OWNER_NOTIFICATION_EMAIL,userId:'owner'}),config),e=>e.code==='INVALID_PREFERENCE');
  state.user.emailVerified=false;
  await assert.rejects(preferencesEndpoint(request('/api/preferences',{groupId:'intermedio'}),config),e=>e.code==='EMAIL_NOT_VERIFIED');
  await assert.rejects(sessionEndpoint(request('/api/session',{}),config),e=>e.code==='EMAIL_NOT_VERIFIED');
  assert.equal(calls.length,0);assert(!queries.some(q=>q.query.includes('pending-request-email-claim')));
});
test('registration itself never notifies and the existing Google callback preserves the admin navigation hash',async t=>{
  const {queries}=backend(t);const {calls}=smtp(t);
  await authProxy(request('/api/auth/sign-up/email',{name:applicant.name,email:applicant.email,password:'test-password'}),config);
  assert.equal(calls.length,0);assert(!queries.some(q=>q.query.includes('pending-request-email-claim')));
  assert.equal(safeHash(new URL(ADMIN_REVIEW_URL).hash),'#solicitudes-pendientes');
});
test('the email link grants no administrative privilege to an ordinary or pending user',async t=>{
  const {state}=backend(t);state.member.status='approved';
  await assert.rejects(adminEndpoint(request('/api/admin?view=overview'),config),e=>e.code==='FORBIDDEN');
  state.member.status='pending';
  await assert.rejects(adminEndpoint(request('/api/admin?view=overview'),config),e=>e.code==='ACCOUNT_PENDING');
});

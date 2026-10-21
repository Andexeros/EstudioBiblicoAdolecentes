import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { NEON_AUTH_SESSION_COOKIE_NAME as TOKEN } from '@neondatabase/auth/server';
import { notifyApproval, sendApprovalSMTP, smtpConfiguration } from '../server/approval-email.js';
import { approvalEmailTemplate, APPROVAL_SUBJECT, HUELLAS_EMAIL_URL, LOGO_CID } from '../server/approval-email-template.js';
import { adminEndpoint, usersEndpoint } from '../server/api.js';
import { HttpError } from '../server/http.js';

const origin='https://huellas.example', baseUrl='https://auth.example/neondb/auth';
const config={origin,baseUrl,cookieSecret:'test-secret-only-012345678901234567890',sessionDataTtl:60,sameSite:'lax'};
const time=new Date().toISOString();
const person={id:'admin-user',name:'Ana Pérez',email:'ana@example.com',emailVerified:true,createdAt:time,updatedAt:time};
const notification={status:'claimed',id:'db5a12e2-6d21-40da-917d-06a3a12a45b7',attemptId:'f20bf2a5-304c-42f3-aeef-f93536a43782',email:'target@example.com',name:'María Pérez',groupId:'grande'};
const request=(body,headers={})=>new Request(origin+'/api/admin',{method:'POST',headers:{Origin:origin,Cookie:`${TOKEN}=test-session`,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const command=(action='approve',more={})=>({action,userId:'target-user',version:3,confirmed:true,...more});
function sqlResponse(rows){
  const names=Object.keys(rows[0]||{}),types=names.map(name=>typeof rows[0]?.[name]==='boolean'?16:typeof rows[0]?.[name]==='object'?3802:25);
  return Response.json({fields:names.map((name,i)=>({name,dataTypeID:types[i]})),rows:rows.map(row=>names.map((name,i)=>row[name]==null?null:types[i]===16?(row[name]?'t':'f'):types[i]===3802?JSON.stringify(row[name]):String(row[name]))),rowCount:rows.length,command:'SELECT'});
}
function backend(t,overrides={}){
  const state={user:{...person},member:{user_id:person.id,status:'approved',role:'owner',version:1,study_group:'adolescentes'},allowed:true,committed:false,claimed:false,saved:true,notification:{...notification},...overrides};
  const queries=[];
  t.mock.method(globalThis,'fetch',async(url,init={})=>{
    if(String(url).startsWith(baseUrl))return Response.json({user:state.user,session:{id:'session',userId:person.id,token:'test-session',createdAt:time,updatedAt:time,expiresAt:new Date(Date.now()+3600000).toISOString()}});
    const {query,params}=JSON.parse(init.body);queries.push({query,params});
    if(query.includes('huellas:membership'))return sqlResponse([state.member]);
    if(query.includes('huellas:limit'))return sqlResponse([{allowed:state.allowed}]);
    if(query.includes('huellas:action')){
      if(state.actionError)return Response.json({message:state.actionError,code:'P0001'},{status:400});
      state.committed=true;return sqlResponse([{result:{version:4,status:'approved',role:'user'}}]);
    }
    if(query.includes('huellas:approval-email-claim')){
      if(state.claimError)return Response.json({message:state.claimError,code:'P0001'},{status:400});
      if(state.claimed)return sqlResponse([{result:{status:state.finished?'unchanged':'sending'}}]);
      if(state.notification.status==='claimed')state.claimed=true;
      return sqlResponse([{result:state.notification}]);
    }
    if(query.includes('huellas:approval-email-finish')){
      if(state.finishError)throw new Error('database unavailable');
      state.finished=true;return sqlResponse([{saved:state.saved}]);
    }
    if(query.includes('huellas:users'))return sqlResponse(state.users||[]);
    throw new Error('Unexpected database operation');
  });
  return {state,queries};
}
function smtp(t,handler){
  const calls=[],options=[],closed=[];
  t.mock.method(nodemailer,'createTransport',value=>{
    options.push(value);
    return {close(){closed.push(true);},async sendMail(message){calls.push(message);return handler?handler(message):{accepted:[notification.email],messageId:'<test-message@example.com>'};}};
  });
  return {calls,options,closed};
}
beforeEach(()=>{
  process.env.DATABASE_URL='postgresql://owner:test-only@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
  process.env.HUELLAS_SMTP_HOST='smtp.example.com';process.env.HUELLAS_SMTP_PORT='587';
  process.env.HUELLAS_SMTP_USER='test-user';process.env.HUELLAS_SMTP_PASSWORD='private-test-only';process.env.HUELLAS_SMTP_FROM='huellas@example.com';
});

test('approval templates preserve the requested text, real group names, fixed HTTPS link and safe HTML',()=>{
  for(const [groupId,label]of [['adolescentes','Adolescentes'],['intermedio','Grupo Intermedio'],['grande','Grupo Grande']]){
    const rendered=approvalEmailTemplate({name:'María <img src=x onerror=alert(1)> & Pérez',groupId});
    assert.equal(rendered.subject,APPROVAL_SUBJECT);assert.equal(rendered.subject,'¡Tu cuenta de Huellas fue aprobada! 📖');
    assert(rendered.text.includes('¡Paz del Señor, María'));assert(rendered.text.includes('Tu grupo: '+label));
    assert(rendered.html.includes('Tu grupo:</strong> '+label));assert(rendered.html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; Pérez'));
    assert(!rendered.html.includes('<img src=x'));assert(!/<script\b|<svg\b|url\(/i.test(rendered.html));
    assert(rendered.html.includes('src="cid:'+LOGO_CID+'"'));assert(rendered.html.includes('max-width:560px'));
    for(const link of rendered.html.matchAll(/href="([^"]+)"/g))assert.equal(link[1],HUELLAS_EMAIL_URL);
  }
});
test('SMTP uses mandatory encryption, private credentials and bounded server timeouts',()=>{
  const settings=smtpConfiguration();assert.equal(settings.secure,false);assert.equal(settings.requireTLS,true);
  assert.equal(settings.tls.rejectUnauthorized,true);assert.equal(settings.tls.minVersion,'TLSv1.2');
  assert.equal(settings.auth.pass,'private-test-only');assert.equal(settings.debug,false);assert.equal(settings.logger,false);
  assert.equal(settings.disableFileAccess,true);assert.equal(settings.disableUrlAccess,true);assert(settings.socketTimeout<20000);
  assert.equal(smtpConfiguration({...process.env,HUELLAS_SMTP_PORT:'465'}).secure,true);
  for(const patch of [{HUELLAS_SMTP_PASSWORD:''},{HUELLAS_SMTP_HOST:'https://smtp.example.com'},{HUELLAS_SMTP_PORT:'-1'},{HUELLAS_SMTP_FROM:'Huellas <huellas@example.com>'},{HUELLAS_SMTP_FROM:'safe@example.com\r\nBcc:other@example.com'}]){
    assert.throws(()=>smtpConfiguration({...process.env,...patch}),error=>error.code==='SMTP_NOT_CONFIGURED');
  }
});
test('server SMTP sends one verified recipient, plain text, HTML and the existing Bible PNG embedded by CID',async t=>{
  const {calls,closed}=smtp(t);await sendApprovalSMTP(notification);
  assert.equal(calls.length,1);const message=calls[0];
  assert.deepEqual(message.to,{address:notification.email});assert.equal(message.from.address,'huellas@example.com');
  assert.equal(message.subject,APPROVAL_SUBJECT);assert(message.html.includes('Grupo Grande'));assert(message.text.includes(HUELLAS_EMAIL_URL));
  assert.equal(message.attachments.length,1);const logo=message.attachments[0];
  assert.equal(logo.cid,LOGO_CID);assert.equal(logo.contentType,'image/png');assert.equal(logo.contentDisposition,'inline');
  assert(Buffer.isBuffer(logo.content));assert.equal(logo.content.subarray(1,4).toString(),'PNG');
  assert(!JSON.stringify(message).includes(process.env.HUELLAS_SMTP_PASSWORD));assert(closed.length>0);
});
test('the outgoing message compiles as MIME with both alternatives and a related PNG without contacting SMTP',async t=>{
  const original=nodemailer.createTransport,transport=original({streamTransport:true,buffer:true});let mime;
  smtp(t,async message=>{mime=(await transport.sendMail(message)).message.toString();return {accepted:[notification.email],messageId:message.messageId};});
  await sendApprovalSMTP(notification);
  assert.match(mime,/multipart\/alternative/);assert.match(mime,/multipart\/related/);
  assert.match(mime,/Content-Type: text\/plain; charset=utf-8/i);assert.match(mime,/Content-Type: text\/html; charset=utf-8/i);
  assert(mime.includes('Content-ID: <'+LOGO_CID+'>'));assert.match(mime,/Content-Type: image\/png/i);
});
test('an SMTP server that never responds reaches the deadline and closes without hanging the approval request',async t=>{
  let ready,closed=0;const created=new Promise(resolve=>{ready=resolve;});
  t.mock.method(nodemailer,'createTransport',()=>{ready();return {close(){closed++;},sendMail(){return new Promise(()=>{});}};});
  t.mock.timers.enable({apis:['setTimeout']});
  const pending=assert.rejects(sendApprovalSMTP(notification),error=>error.code==='SMTP_DEADLINE');
  await created;t.mock.timers.tick(11000);await pending;assert(closed>0);
});
test('a successful notification is claimed atomically and its provider acceptance is recorded',async t=>{
  const {queries}=backend(t);let sent=0;
  const result=await notifyApproval(person.id,'target-user',4,{send:async data=>{sent++;assert.equal(data.email,notification.email);return {messageId:'provider-id'};}});
  assert.deepEqual(result,{status:'sent'});assert.equal(sent,1);
  assert.deepEqual(queries[0].params,[person.id,'target-user','4','false']);
  assert.deepEqual(queries.at(-1).params,[notification.id,notification.attemptId,'sent','provider-id',null]);
  assert(queries.every(item=>!item.query.includes(notification.email)));
});
test('two simultaneous notifications produce only one send',async t=>{
  const {queries}=backend(t);let sends=0;
  const options={send:async()=>{sends++;return {messageId:'once'};}};
  const results=await Promise.all([notifyApproval(person.id,'target-user',4,options),notifyApproval(person.id,'target-user',4,options)]);
  assert.equal(sends,1);assert.equal(queries.filter(item=>item.query.includes('approval-email-finish')).length,1);
  assert(results.some(result=>result.status==='sent'));assert(results.some(result=>result.status==='sending'||result.status==='unchanged'));
});
for(const status of ['unchanged','already_sent','sending','cooldown','not_applicable'])test(`a ${status} claim never sends a message`,async t=>{
  backend(t,{notification:{status}});let sends=0;
  assert.deepEqual(await notifyApproval(person.id,'target-user',4,{send:async()=>{sends++;}}),{status});assert.equal(sends,0);
});
for(const [code,expected,status]of [['SMTP_NOT_CONFIGURED','SMTP_NOT_CONFIGURED','failed'],['EAUTH','SMTP_AUTH_FAILED','failed'],['EENVELOPE','SMTP_REJECTED','failed'],['ETIMEDOUT','SMTP_UNCERTAIN','uncertain']])test(`${code} is recorded without retrying or changing approval`,async t=>{
  const {queries,state}=backend(t,{committed:true});let sends=0;
  const send=async()=>{sends++;throw Object.assign(new Error('contains private provider details'),{code});};
  assert.deepEqual(await notifyApproval(person.id,'target-user',4,{send}),{status,code:expected});
  await notifyApproval(person.id,'target-user',4,{send});assert.equal(sends,1);assert.equal(state.committed,true);
  assert.equal(queries.find(item=>item.query.includes('approval-email-finish')).params.at(-1),expected);
});
test('a missing final database acknowledgment is reported as uncertain and never triggers an automatic second send',async t=>{
  const {state}=backend(t,{finishError:true,committed:true});t.mock.method(console,'error',()=>{});let sends=0;
  const send=async()=>{sends++;return {messageId:'accepted'};};
  assert.deepEqual(await notifyApproval(person.id,'target-user',4,{send}),{status:'uncertain'});
  await notifyApproval(person.id,'target-user',4,{send});assert.equal(sends,1);assert.equal(state.committed,true);
});
test('the approval endpoint commits first, sends afterwards and returns no private recipient or SMTP configuration',async t=>{
  const {state,queries}=backend(t);const {calls}=smtp(t,()=>{assert.equal(state.committed,true);return {accepted:[notification.email],messageId:'accepted'};});
  const result=await(await adminEndpoint(request(command()),config)).json();
  assert.deepEqual(result,{ok:true,notification:{status:'sent'}});assert.equal(calls.length,1);
  assert(queries.findIndex(item=>item.query.includes('huellas:action'))<queries.findIndex(item=>item.query.includes('approval-email-claim')));
  assert.deepEqual(queries.find(item=>item.query.includes('approval-email-claim')).params,[person.id,'target-user','4','false']);
  assert(!JSON.stringify(result).includes('private-test-only'));assert(!JSON.stringify(result).includes(notification.email));
  state.actionError='HUELLAS_INVALID_TRANSITION';
  await assert.rejects(adminEndpoint(request(command()),config),error=>error.code==='INVALID_TRANSITION');assert.equal(calls.length,1);
});
test('SMTP configuration and notification storage failures never revert a successful approval or report it as failed',async t=>{
  const {state,queries}=backend(t);delete process.env.HUELLAS_SMTP_PASSWORD;const {calls}=smtp(t);
  const result=await(await adminEndpoint(request(command()),config)).json();
  assert.equal(result.ok,true);assert.equal(result.notification.code,'SMTP_NOT_CONFIGURED');assert.equal(state.committed,true);assert.equal(calls.length,0);
  assert.equal(queries.find(item=>item.query.includes('approval-email-finish')).params[2],'failed');
  state.claimError='database unavailable';t.mock.method(console,'error',()=>{});
  const response=await adminEndpoint(request(command()),config);assert.equal(response.status,200);assert.equal((await response.json()).notification.status,'unavailable');
});
test('rejection, reactivation, blocking, groups and role changes do not send approval messages',async t=>{
  const {queries}=backend(t);const {calls}=smtp(t);
  for(const action of ['reject','reactivate','block','set_group','grant_admin','revoke_admin']){
    await adminEndpoint(request(command(action,action==='set_group'?{groupId:'grande'}:{})),config);
  }
  assert.equal(calls.length,0);assert(!queries.some(item=>item.query.includes('approval-email-claim')));
});
for(const action of ['send_approval_email','resend_approval_email'])test(`${action} uses the authenticated actor, current version, existing permissions and rate limits`,async t=>{
  const {queries,state}=backend(t);const {calls}=smtp(t);
  assert.equal((await adminEndpoint(request(command(action)),config)).status,200);assert.equal(calls.length,1);
  assert.deepEqual(queries.find(item=>item.query.includes('approval-email-claim')).params,[person.id,'target-user','3','true']);
  assert.equal(queries.filter(item=>item.query.includes('huellas:limit')).length,3);assert(!queries.some(item=>item.query.includes('huellas:action')));
  state.allowed=false;await assert.rejects(adminEndpoint(request(command(action)),config),error=>error.code==='TOO_MANY_REQUESTS');assert.equal(calls.length,1);
});
test('welcoming an already-approved user does not mutate approval, groups, roles or the administrative audit',async t=>{
  const {queries,state}=backend(t);const {calls}=smtp(t);const before={...state.member};
  const result=await(await adminEndpoint(request(command('send_approval_email')),config)).json();
  assert.deepEqual(result,{ok:true,notification:{status:'sent'}});assert.equal(calls.length,1);
  assert.equal(state.committed,false);assert.deepEqual(state.member,before);
  assert(!queries.some(({query})=>query.includes('huellas:action')||/UPDATE|INSERT|DELETE/.test(query)));
});
test('a repeated welcome request for a recorded success does not open SMTP or alter approval',async t=>{
  const {queries,state}=backend(t,{notification:{status:'already_sent'}});const {calls}=smtp(t);
  for(const action of ['send_approval_email','resend_approval_email']){
    const result=await(await adminEndpoint(request(command(action)),config)).json();
    assert.deepEqual(result,{ok:true,notification:{status:'already_sent'}});
  }
  assert.equal(calls.length,0);assert.equal(state.committed,false);
  assert(!queries.some(({query})=>query.includes('approval-email-finish')||query.includes('huellas:action')));
});
test('a failed manual welcome records the failure while leaving the approved account unchanged',async t=>{
  const {queries,state}=backend(t);const before={...state.member};
  const {calls}=smtp(t,()=>{throw Object.assign(new Error('private SMTP detail'),{code:'EAUTH'});});
  const result=await(await adminEndpoint(request(command('send_approval_email')),config)).json();
  assert.deepEqual(result,{ok:true,notification:{status:'failed',code:'SMTP_AUTH_FAILED'}});
  assert.equal(calls.length,1);assert.deepEqual(state.member,before);assert.equal(state.committed,false);
  assert.equal(queries.find(({query})=>query.includes('approval-email-finish')).params[2],'failed');
});
for(const action of ['send_approval_email','resend_approval_email'])test(`ordinary, blocked, pending and unverified users cannot use ${action}; browser payloads cannot choose the sender or recipient`,async t=>{
  const {state,queries}=backend(t);const {calls}=smtp(t);
  for(const patch of [{status:'approved',role:'user'},{status:'blocked',role:'owner'},{status:'pending',role:'admin'}]){
    Object.assign(state.member,patch);await assert.rejects(adminEndpoint(request(command(action)),config),error=>error instanceof HttpError&&error.status===403);
  }
  Object.assign(state.member,{status:'approved',role:'admin'});state.user.emailVerified=false;
  await assert.rejects(adminEndpoint(request(command(action)),config),error=>error.code==='EMAIL_NOT_VERIFIED');
  state.user.emailVerified=true;
  for(const patch of [{email:'other@example.com'},{actorId:'owner'},{role:'owner'},{smtpPassword:'forged'}]){
    await assert.rejects(adminEndpoint(request(command(action,patch)),config),error=>error.code==='INVALID_ACTION');
  }
  assert.equal(calls.length,0);assert(!queries.some(item=>item.query.includes('approval-email-claim')));
});
for(const action of ['send_approval_email','resend_approval_email'])test(`SQL permission revocation, protected targets and unverified recipients are enforced before ${action}`,async t=>{
  const {state}=backend(t);const {calls}=smtp(t);
  for(const code of ['FORBIDDEN','OWNER_PROTECTED','EMAIL_NOT_VERIFIED','PROFILE_REQUIRED','STALE_USER','INVALID_TRANSITION']){
    state.claimError='HUELLAS_'+code;
    await assert.rejects(adminEndpoint(request(command(action)),config),error=>error.code===code);
  }
  assert.equal(calls.length,0);
});
test('user listings expose delivery status and dates using the same protected query without exposing message contents',async t=>{
  const {queries}=backend(t,{users:[{id:'target-user',approvalEmailStatus:'sent',approvalEmailSentAt:time,total:1}]});
  const response=await usersEndpoint(new Request(origin+'/api/users',{headers:{Cookie:`${TOKEN}=test-session`}}),config);
  const result=await response.json();assert.equal(result.users[0].approvalEmailStatus,'sent');
  const query=queries.find(item=>item.query.includes('huellas:users')).query;
  assert(query.includes('LEFT JOIN LATERAL'));assert(query.includes('public.huellas_approval_emails'));assert(!query.includes('recipient_email AS'));
  assert.match(response.headers.get('cache-control'),/private, no-store/);
});

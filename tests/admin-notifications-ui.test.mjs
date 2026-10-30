import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminPanel } from '../admin.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t,{hash='#solicitudes-pendientes',hidden=false}={}){
  const elements=new Map();
  function element(id){
    if(!elements.has(id))elements.set(id,{id,open:false,hidden:false,value:'',textContent:'',innerHTML:'',dataset:{},children:[],handlers:new Map(),attributes:{},
      append(child){this.children.push(child);},replaceChildren(){this.children=[];this.innerHTML='';},
      setAttribute(key,value){this.attributes[key]=value;},getAttribute(key){return this.attributes[key];},
      addEventListener(key,fn){this.handlers.set(key,fn);},focus(){},showModal(){this.open=true;},close(){this.open=false;},
      classList:{toggle(){}},
    });return elements.get(id);
  }
  const saved={document:globalThis.document,location:globalThis.location,history:globalThis.history};
  globalThis.document={hidden,getElementById:element,createElement:()=>element('option-'+Math.random())};
  globalThis.location={hash,pathname:'/',search:''};
  const replacements=[];globalThis.history={state:null,replaceState(...args){replacements.push(args);globalThis.location.hash='';}};
  t.after(()=>{for(const[key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
  element('users-sort').value='registered_desc';element('admin-audit-section').hidden=true;
  const requests=[],state={pending:3};
  const panel=createAdminPanel({
    async request(url){requests.push(url);if(url.startsWith('/api/admin'))return {metrics:{pending:state.pending,total:4},deletionEnabled:false};return {users:[],hasMore:false,total:0};},
    errorText:error=>error.message,onPermissionChange(){},
  });
  const session=(role='admin')=>({isAdmin:['owner','admin'].includes(role),access:{status:'approved',role}});
  return {element,requests,panel,state,session,replacements};
}

test('the email opens pending requests only after authorized application initialization',async t=>{
  const f=fixture(t);f.element('huellas-app').hidden=true;
  assert.equal(f.panel.openRequestedView(),false);assert.equal(f.requests.length,0);
  f.panel.setSession(f.session());assert.equal(f.panel.openRequestedView(),false);
  f.element('huellas-app').hidden=false;
  // The existing class router may already have selected the first class.
  globalThis.location.hash='#rut';
  assert.equal(f.panel.openRequestedView(),true);await tick();
  assert.equal(f.element('users-dialog').open,true);assert.equal(f.element('users-status-filter').value,'pending');
  assert.equal(f.element('admin-pending-count').textContent,'3');assert(f.requests.some(url=>url.includes('status=pending')));
  const count=f.requests.length;assert.equal(f.panel.openRequestedView(),false);assert.equal(f.requests.length,count);
  assert.equal(globalThis.location.hash,'#rut');
});
test('ordinary users cannot open the admin destination through the email hash',t=>{
  const f=fixture(t);f.panel.setSession(f.session('user'));
  assert.equal(f.panel.openRequestedView(),false);assert.equal(f.element('users-dialog').open,false);assert.equal(f.requests.length,0);
});
test('the existing session monitor refreshes the visible counter and shows zero',async t=>{
  const f=fixture(t);f.panel.setSession(f.session('owner'));f.panel.openRequestedView();await tick();
  assert.equal(f.element('admin-pending-count').textContent,'3');
  f.state.pending=0;f.panel.setSession(f.session('owner'));await tick();
  assert.equal(f.element('admin-pending-count').textContent,'0');
  const count=f.requests.length;
  globalThis.document.hidden=true;f.panel.setSession(f.session('owner'));await tick();assert.equal(f.requests.length,count);
  globalThis.document.hidden=false;f.element('users-dialog').close();f.panel.setSession(f.session('owner'));await tick();assert.equal(f.requests.length,count);
});
test('revoking permission closes the panel, clears the private count and prevents reopening',async t=>{
  const f=fixture(t);f.panel.setSession(f.session());f.panel.openRequestedView();await tick();
  f.panel.setSession(f.session('user'));assert.equal(f.element('users-dialog').open,false);assert.equal(f.element('admin-pending-count').textContent,'0');
  assert.equal(f.panel.openRequestedView(),false);
});

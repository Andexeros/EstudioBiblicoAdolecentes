import { studyGroups, groupLabel } from './groups.js?v=20261020-groups1';

const statuses={pending:'Pendiente',approved:'Aprobado',rejected:'Rechazado',blocked:'Bloqueado'};
const roles={owner:'Propietario',admin:'Administrador',user:'Usuario'};
const actions={approve:'Aprobar cuenta',reject:'Rechazar solicitud',block:'Bloquear cuenta',reactivate:'Reactivar cuenta',set_group:'Cambiar grupo',grant_admin:'Designar administrador',revoke_admin:'Revocar administrador',delete:'Eliminar cuenta permanentemente'};
const explanations={approve:'La persona podrá acceder a las clases de su grupo.',reject:'La solicitud quedará rechazada y la cuenta no podrá acceder a las clases.',block:'Se revocará el acceso al contenido. La información de la cuenta se conservará para una posible reactivación.',reactivate:'La cuenta volverá a tener acceso a los estudios de su grupo.',set_group:'El grupo se actualizará en Neon y en los próximos accesos de esta persona.',grant_admin:'Esta persona podrá gestionar solicitudes y usuarios ordinarios. No podrá designar administradores ni eliminar cuentas.',revoke_admin:'Se retirarán sus permisos administrativos. Podrá continuar como usuario aprobado.',delete:'Esta acción es irreversible. Se eliminará la identidad en Neon Auth y sus preferencias y accesos de Huellas. El historial administrativo se conserva.'};
const auditLabels={...actions,delete_requested:'Eliminación solicitada',delete_failed:'Eliminación pendiente de confirmar'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dates=new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'});
const date=value=>value&&!Number.isNaN(Date.parse(value))?dates.format(new Date(value)):'Sin acceso registrado';

export function createAdminPanel({request,errorText,onPermissionChange}) {
  const $=id=>document.getElementById(id), dialog=$('users-dialog'), confirm=$('admin-confirm-dialog');
  let role='user',permitted=false,users=[],offset=0,hasMore=false,ticket=0,overviewTicket=0,auditTicket=0,auditBefore=null,selection=null,busy=false,searchTimer,deletionEnabled=false;
  const note=(text='',error=false,id='users-message')=>{$(id).textContent=text;$(id).dataset.error=String(error);};
  for(const group of studyGroups){const option=document.createElement('option');option.value=group.id;option.textContent=group.name;$('admin-target-group').append(option);}
  function pressed(view){for(const[id,key]of [['admin-pending','pending'],['admin-all','all'],['admin-audit','audit']])$(id).setAttribute('aria-pressed',String(key===view));}
  function controlsFor(user){
    if(user.role==='owner')return '<span>Cuenta protegida</span>';
    if(role!=='owner'&&user.role!=='user')return '<span>Gestiona el propietario</span>';
    const list=[];
    if(!user.deletionPending){
      if(user.status==='pending')list.push(['approve',!user.emailVerified],['reject',false]);
      if(['blocked','rejected'].includes(user.status))list.push(['reactivate',!user.emailVerified]);
      if(user.status!=='blocked')list.push(['block',false]);
      list.push(['set_group',false]);
      if(role==='owner'&&user.role==='user'&&user.status==='approved')list.push(['grant_admin',!user.emailVerified]);
      if(role==='owner'&&user.role==='admin')list.push(['revoke_admin',false]);
    }
    if(role==='owner')list.push(['delete',!deletionEnabled]);
    return `<div class="ha-row-actions">${list.map(([action,disabled])=>`<button type="button" data-action="${action}" data-user="${escape(user.id)}" ${disabled||busy?'disabled':''} ${disabled?`title="${action==='delete'?'Falta configurar la API administrativa de Neon':'Primero debe verificar su correo'}"`:''}>${action==='delete'?(user.deletionPending?'Reintentar eliminación':'Eliminar'):escape(actions[action])}</button>`).join('')}</div>`;
  }
  function renderUsers(){
    $('users-rows').innerHTML=users.length?users.map(user=>`<tr><td data-label="Cuenta"><strong>${escape(user.name||'Sin nombre')}</strong><span>${escape(user.email)}</span></td><td data-label="Grupo"><span>${escape(groupLabel(user.study_group))}</span></td><td data-label="Estado"><div><span class="ha-status" data-state="${escape(user.status)}">${escape(statuses[user.status]||'Pendiente')}</span><span>${user.emailVerified?'Correo verificado':'Correo sin verificar'}</span>${user.deletionPending?'<span>Eliminación pendiente</span>':''}</div></td><td data-label="Rol"><span>${escape(roles[user.role]||'Usuario')}</span></td><td data-label="Fechas"><div><p>Registro<br>${escape(date(user.createdAt))}</p><p>Último acceso<br>${escape(date(user.last_seen_at))}</p></div></td><td data-label="Acciones">${controlsFor(user)}</td></tr>`).join(''):'<tr><td colspan="6" class="ha-empty-row">No hay cuentas para estos filtros.</td></tr>';
  }
  async function loadUsers(nextOffset=0){
    if(!permitted)return;
    const current=++ticket;note('Cargando usuarios…');$('users-previous').disabled=true;$('users-next').disabled=true;
    const params=new URLSearchParams({offset:String(nextOffset),group:$('users-group-filter').value,status:$('users-status-filter').value,role:$('users-role-filter').value,search:$('users-search').value.trim(),sort:$('users-sort').value});
    try{
      const data=await request('/api/users?'+params);
      if(current!==ticket||!permitted)return;
      users=data.users;offset=nextOffset;hasMore=data.hasMore;renderUsers();
      note(`${data.total} ${data.total===1?'cuenta':'cuentas'} en este listado.`);
      $('users-page').textContent=users.length?`${offset+1}–${offset+users.length}`:'Sin usuarios';
    }catch(error){if(current!==ticket)return;users=[];renderUsers();note(errorText(error),true);if([401,403].includes(error.status))onPermissionChange();}
    finally{if(current===ticket){$('users-previous').disabled=offset===0||busy;$('users-next').disabled=!hasMore||busy;}}
  }
  async function loadOverview(){
    const current=++overviewTicket;
    try{
      const data=await request('/api/admin?view=overview');if(current!==overviewTicket||!permitted)return;
      deletionEnabled=data.deletionEnabled===true;const m=data.metrics||{};
      const metrics=[['total','Cuentas registradas'],['pending','Solicitudes pendientes'],['approved','Usuarios aprobados'],['blocked','Cuentas bloqueadas'],['new7','Nuevas en 7 días'],['new30','Nuevas en 30 días'],['rejected','Solicitudes rechazadas']];
      $('admin-metrics').innerHTML=metrics.map(([key,label])=>`<div class="ha-metric"><strong>${Number(m[key]||0).toLocaleString('es-AR')}</strong><span>${label}</span></div>`).join('');
      $('admin-pending-count').textContent=String(Number(m.pending||0));
      $('admin-distribution').innerHTML=[...studyGroups.map(g=>[g.id,g.name]),['unassigned','Sin grupo']].map(([key,label])=>`<span>${escape(label)} <b>${Number(m[key]||0).toLocaleString('es-AR')}</b></span>`).join('');
      renderUsers();
    }catch(error){if(current===overviewTicket){note(errorText(error),true);if([401,403].includes(error.status))onPermissionChange();}}
  }
  async function loadAudit(more=false){
    if(!permitted||role!=='owner')return;const current=++auditTicket;
    $('admin-audit-more').disabled=true;note('Cargando historial…');
    try{
      const data=await request('/api/admin?view=audit'+(more&&auditBefore?'&before='+encodeURIComponent(auditBefore):''));
      if(current!==auditTicket||role!=='owner')return;
      if(!more)$('admin-audit-list').replaceChildren();
      for(const entry of data.entries){
        const item=document.createElement('li');
        item.innerHTML=`<div><h4>${escape(auditLabels[entry.action]||entry.action)}</h4><p>Responsable: ${escape(entry.actor_name||entry.actor_id)}</p><p>Cuenta: ${escape(entry.target_name||entry.target_id)}</p><small>ID de cuenta: ${escape(entry.target_id)}</small></div><time>${escape(date(entry.created_at))}</time>`;
        $('admin-audit-list').append(item);
      }
      auditBefore=data.next;$('admin-audit-more').hidden=!auditBefore;
      note($('admin-audit-list').children.length?'':'Todavía no hay acciones registradas.');
    }catch(error){if(current===auditTicket)note(errorText(error),true);}
    finally{$('admin-audit-more').disabled=false;}
  }
  function listView(pending=false){
    clearTimeout(searchTimer);$('admin-list-section').hidden=false;$('admin-audit-section').hidden=true;
    $('users-status-filter').value=pending?'pending':'';pressed(pending?'pending':'all');
    $('admin-list-title').textContent=pending?'Solicitudes pendientes':'Usuarios de Huellas';loadUsers(0);
  }
  function begin(user,action,button){
    if(busy||!permitted)return;selection={user,action,button};note('',false,'admin-confirm-message');
    $('admin-confirm-title').textContent=actions[action];$('admin-confirm-description').textContent=explanations[action];
    $('admin-confirm-person').textContent=`${user.name||'Sin nombre'} · ${user.email}`;
    $('admin-group-field').hidden=action!=='set_group';$('admin-target-group').required=action==='set_group';$('admin-target-group').value=user.study_group||'';
    $('admin-delete-field').hidden=action!=='delete';$('admin-delete-confirmation').required=action==='delete';$('admin-delete-confirmation').value='';
    $('admin-confirm-submit').textContent=action==='delete'?'Eliminar permanentemente':'Confirmar';$('admin-confirm-submit').classList.toggle('ha-danger',action==='delete');
    confirm.showModal();(action==='delete'?$('admin-delete-confirmation'):$('admin-cancel')).focus();
  }
  $('users-rows').addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(!button||button.disabled)return;const user=users.find(u=>u.id===button.dataset.user);if(user)begin(user,button.dataset.action,button);});
  $('admin-action-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!selection||!permitted||!event.currentTarget.reportValidity())return;
    const{user,action}=selection;
    if(action==='delete'&&$('admin-delete-confirmation').value.trim().toLowerCase()!==user.email.toLowerCase()){note('El correo no coincide con la cuenta seleccionada.',true,'admin-confirm-message');return;}
    const payload={action,userId:user.id,version:Number(user.version),confirmed:true};
    if(action==='set_group')payload.groupId=$('admin-target-group').value;
    if(action==='delete')payload.confirmation=$('admin-delete-confirmation').value.trim();
    busy=true;$('admin-action-form').setAttribute('aria-busy','true');$('admin-confirm-submit').disabled=true;$('admin-cancel').disabled=true;renderUsers();
    try{await request('/api/admin',payload);confirm.close();await Promise.all([loadUsers(offset),loadOverview()]);note('Cambio guardado.');}
    catch(error){note(errorText(error),true,'admin-confirm-message');if([401,403].includes(error.status))onPermissionChange();if(error.status===409||error.code==='DELETE_INCOMPLETE')loadUsers(offset);}
    finally{busy=false;$('admin-action-form').setAttribute('aria-busy','false');$('admin-confirm-submit').disabled=false;$('admin-cancel').disabled=false;renderUsers();$('users-previous').disabled=offset===0;$('users-next').disabled=!hasMore;}
  });
  $('admin-cancel').addEventListener('click',()=>{if(!busy)confirm.close();});
  confirm.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  confirm.addEventListener('close',()=>{const button=selection?.button;selection=null;if(dialog.open)(button?.isConnected?button:$('users-search')).focus();});
  $('admin-filters').addEventListener('submit',event=>{event.preventDefault();loadUsers(0);});
  $('users-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadUsers(0),350);});
  for(const id of ['users-group-filter','users-role-filter','users-status-filter','users-sort'])$(id).addEventListener('change',()=>{pressed($('users-status-filter').value==='pending'?'pending':'all');$('admin-list-title').textContent=$('users-status-filter').value==='pending'?'Solicitudes pendientes':'Usuarios de Huellas';loadUsers(0);});
  $('users-previous').addEventListener('click',()=>loadUsers(Math.max(0,offset-50)));$('users-next').addEventListener('click',()=>loadUsers(offset+50));
  $('admin-pending').addEventListener('click',()=>listView(true));$('admin-all').addEventListener('click',()=>listView(false));
  $('admin-roles').addEventListener('click',()=>{if(role!=='owner')return;$('users-role-filter').value='';$('admin-list-section').hidden=false;$('admin-audit-section').hidden=true;pressed('all');$('users-status-filter').value='approved';$('admin-list-title').textContent='Gestionar administradores';loadUsers(0);});
  $('admin-audit').addEventListener('click',()=>{if(role!=='owner')return;pressed('audit');$('admin-list-section').hidden=true;$('admin-audit-section').hidden=false;loadAudit();});
  $('admin-audit-more').addEventListener('click',()=>loadAudit(true));
  $('admin-refresh').addEventListener('click',()=>{loadOverview();if(!$('admin-audit-section').hidden)loadAudit();else loadUsers(offset);});
  $('open-users').addEventListener('click',()=>{if(!permitted)return;$('account-dialog').close();dialog.showModal();listView(true);loadOverview();});
  return {
    setSession(session){
      const previous=role;role=session.access?.role||'user';permitted=session.isAdmin===true&&session.access?.status==='approved';
      $('open-users').hidden=!permitted;$('admin-roles').hidden=!permitted||role!=='owner';$('admin-audit').hidden=!permitted||role!=='owner';
      if(!permitted){++ticket;++overviewTicket;++auditTicket;clearTimeout(searchTimer);if(confirm.open)confirm.close();if(dialog.open)dialog.close();users=[];$('users-rows').replaceChildren();$('admin-metrics').replaceChildren();$('admin-distribution').replaceChildren();$('admin-audit-list').replaceChildren();}
      else if(previous!==role&&dialog.open){if(role!=='owner'&&!$('admin-audit-section').hidden)listView(false);renderUsers();}
    },
  };
}

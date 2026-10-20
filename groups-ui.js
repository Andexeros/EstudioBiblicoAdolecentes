import { studyGroups, groupLabel } from './groups.js?v=20261020-groups1';

export function createGroupExperience({ request, message, errorText }) {
  const $ = id => document.getElementById(id);
  let preferredGroup = null, study = null, admin = false, loadTicket = 0, appModule, saving = false;
  const cards = (containerId, name) => {
    const container = $(containerId);
    for (const [index, group] of studyGroups.entries()) {
      const label = document.createElement('label'); label.className = 'hg-choice';
      const input = document.createElement('input'); input.type = 'radio'; input.name = name; input.value = group.id; input.required = true;
      const number = document.createElement('span'); number.className = 'hg-choice-number'; number.textContent = String(index + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'), title = document.createElement('strong'), description = document.createElement('span');
      title.textContent = group.name; description.textContent = group.description; text.append(title, description);
      label.append(input, number, text); container.append(label);
    }
  };
  cards('group-welcome-choices', 'welcome-group'); cards('group-profile-choices', 'profile-group');
  const selectGroup = (formId, id) => $(formId).querySelectorAll('input[type=radio]').forEach(input => { input.checked = input.value === id; });
  for (const group of studyGroups) for (const select of [$('group-preview-select'), $('users-group-filter')]) {
    const option = document.createElement('option'); option.value = group.id; option.textContent = group.name; select.append(option);
  }
  const unset = document.createElement('option'); unset.value = 'unassigned'; unset.textContent = 'Sin grupo'; $('users-group-filter').append(unset);

  function updateCollectionPicker() {
    const picker = $('collection-picker'); picker.replaceChildren();
    for (const collection of study.collections) {
      const option = document.createElement('option'); option.value = collection.id; option.textContent = collection.label; picker.append(option);
    }
    picker.value = study.collection.id; $('collection-picker-field').hidden = study.collections.length < 2;
  }
  async function applyStudy(data, ticket) {
    if (!data || !Array.isArray(data.lessons) || !data.collection || !Array.isArray(data.collections)) throw new Error('No pudimos cargar tus estudios. Volvé a intentar.');
    appModule ||= await import('./app.js?v=20261020-clases1');
    if (ticket !== loadTicket) return;
    study = data;
    $('auth-screen').hidden = true; $('group-welcome').hidden = true;
    $('huellas-app').hidden = false; $('huellas-app').inert = false;
    appModule.mountHuellas(study.lessons, study);
    updateCollectionPicker();
    const preview = study.groupId !== preferredGroup;
    $('group-preview-banner').hidden = !preview;
    $('group-preview-name').textContent = study.groupName;
    $('group-preview-select').value = study.groupId;
    document.title = 'Huellas · Estudios Bíblicos';
  }
  async function loadStudy(groupId, collectionId = '') {
    if (saving) throw new Error('Esperá a que termine de guardarse tu grupo.');
    const ticket = ++loadTicket, params = new URLSearchParams();
    if (groupId !== preferredGroup) params.set('previewGroup', groupId);
    if (collectionId) params.set('collection', collectionId);
    $('group-notice').textContent = 'Cargando estudios…';
    try { const data = await request('/api/lessons' + (params.size ? '?' + params : '')); await applyStudy(data, ticket); if (ticket === loadTicket) $('group-notice').textContent = ''; }
    catch (error) { if (ticket === loadTicket) { $('group-notice').textContent = errorText(error); if (study) $('collection-picker').value = study.collection.id; } throw error; }
  }
  function bindSave(formId, fieldsId, buttonId, messageId, welcome) {
    const form = $(formId), button = $(buttonId), fields = $(fieldsId);
    form.addEventListener('change', () => { button.disabled = !form.querySelector('input:checked'); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving || fields.disabled || !form.reportValidity()) return;
      const groupId = form.querySelector('input:checked')?.value;
      if (!groupId) return;
      saving = true; fields.disabled = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
      const original = button.textContent; button.textContent = 'Guardando…'; message('', false, messageId);
      const ticket = ++loadTicket;
      try {
        const data = await request('/api/preferences', { groupId });
        preferredGroup = data.groupId;
        selectGroup('group-profile-form', preferredGroup);
        await applyStudy(data.study, ticket);
        if ($('account-dialog').open) $('account-dialog').close();
        $('group-notice').textContent = `Tu grupo es ${groupLabel(preferredGroup)}. Preferencia guardada.`;
        if (welcome) $('account-button').focus({ preventScroll: true });
      } catch (error) { message(errorText(error), true, messageId); }
      finally { saving = false; fields.disabled = false; button.disabled = false; button.textContent = original; form.setAttribute('aria-busy', 'false'); }
    });
  }
  bindSave('group-welcome-form', 'group-welcome-fields', 'group-continue', 'group-welcome-message', true);
  bindSave('group-profile-form', 'group-profile-fields', 'group-save', 'group-profile-message', false);
  $('group-welcome-logout').addEventListener('click', async () => {
    $('group-welcome-logout').disabled = true;
    try { await request('/api/auth/sign-out', {}); location.replace(location.pathname + location.hash); }
    catch (error) { message(errorText(error), true, 'group-welcome-message'); $('group-welcome-logout').disabled = false; }
  });
  $('empty-change-group').addEventListener('click', () => $('account-button').click());
  $('group-preview-button').addEventListener('click', async () => {
    if (!admin) return;
    $('group-preview-button').disabled = true; message('', false, 'group-profile-message');
    try { await loadStudy($('group-preview-select').value); $('account-dialog').close(); }
    catch (error) { message(errorText(error), true, 'group-profile-message'); }
    finally { $('group-preview-button').disabled = false; }
  });
  $('group-preview-return').addEventListener('click', async () => {
    $('group-preview-return').disabled = true;
    try { await loadStudy(preferredGroup); } catch { /* The visible notice includes the error. */ }
    finally { $('group-preview-return').disabled = false; }
  });
  $('collection-picker').addEventListener('change', async () => {
    $('collection-picker').disabled = true;
    try { await loadStudy(study.groupId, $('collection-picker').value); } catch { /* Retain the previous collection on failure. */ }
    finally { $('collection-picker').disabled = false; }
  });
  return {
    async open(session) {
      admin = session.isAdmin === true; $('group-preview-tools').hidden = !admin;
      const ticket = ++loadTicket, data = await request('/api/preferences');
      preferredGroup = data.groupId; selectGroup('group-profile-form', preferredGroup);
      $('group-save').disabled = !preferredGroup;
      if (!preferredGroup) {
        $('auth-screen').hidden = true; $('huellas-app').hidden = true; $('huellas-app').inert = true;
        $('group-welcome').hidden = false; $('group-welcome-heading').focus();
      } else await applyStudy(data.study, ticket);
    },
  };
}

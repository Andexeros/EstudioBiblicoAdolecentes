import { GeometryArt } from './art.js';

let mounted = null;
export function mountHuellas(initialLessons, initialStudy = {}) {
if (mounted) { mounted.update(initialLessons, initialStudy); return mounted; }
if (!Array.isArray(initialLessons)) throw new Error('No pudimos cargar las clases.');
let lessons = initialLessons;

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const passage = label => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(label.replaceAll('–','-'))}&version=RVR1960`;
const refLink = label => label ? `<a class="inline-ref" href="${passage(label)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(label)}: leer en BibleGateway, se abre en otra pestaña">${escape(label)}</a>` : '';
const initialRoute = parseRoute();
let currentIndex = initialRoute.index;
let currentSection = initialRoute.section;
let revealObserver;
let sectionObserver;
let art;
const dialog = $('catalog-dialog');

function parseRoute() {
  let fragment;
  try { fragment = decodeURIComponent(location.hash.slice(1)); }
  catch { fragment = ''; }
  const [id, section = ''] = fragment.split('/');
  const found = lessons.findIndex(l => l.id === id);
  return { index: found < 0 ? 0 : found, section: ['historia','claves','conclusion','referencias'].includes(section) ? section : '' };
}

function navigate(index, section = '') {
  if (!lessons.length) return;
  const next = (index + lessons.length) % lessons.length;
  const hash = `#${lessons[next].id}${section ? '/' + section : ''}`;
  if (location.hash === hash) {
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: preferredScroll() });
    else window.scrollTo({ top: 0, behavior: preferredScroll() });
  } else location.hash = hash;
}

function preferredScroll() { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'; }

function extrasHTML(lesson) {
  if (!lesson.extra) return '';
  return `<div class="series-details" aria-label="${escape(lesson.extraTitle)}">${lesson.extra.map((group, i) => `<details${lesson.id === 'apocalipsis' && i === 0 ? ' open' : ''}>
    <summary><h3>${escape(group.title)}</h3><span aria-hidden="true">+</span></summary>
    <div class="series-items">${group.churches ? `<div class="series-item"><h4>Los mensajes a las siete iglesias</h4><p>Jesús conoce su condición y las llama a la fidelidad.</p>${refLink('Apocalipsis 2–3')}<div class="churches">${group.churches.map(c=>`<div class="church"><h4>${escape(c.title)}</h4><p>${escape(c.text)}</p></div>`).join('')}</div></div>` : ''}
    ${group.items.map(item => `<div class="series-item"><h4>${escape(item.title)}</h4><p>${escape(item.text)}</p>${refLink(item.ref)}</div>`).join('')}</div>
  </details>`).join('')}</div>`;
}

function contentHTML(lesson) {
  const next = lessons[(currentIndex + 1) % lessons.length];
  const route = section => `#${lesson.id}/${section}`;
  return `<article aria-labelledby="study-title">
    <nav class="study-nav" aria-label="Contenido de ${escape(lesson.name)}"><span class="nav-lesson-name">${escape(lesson.name)}</span><a href="${route('historia')}" data-section="historia">Historia</a><a href="${route('claves')}" data-section="claves">Puntos clave</a><a href="${route('conclusion')}" data-section="conclusion">Conclusión</a><a href="${route('referencias')}" data-section="referencias">Referencias</a></nav>
    <div class="study-wrap">
      <div class="study-heading reveal"><p class="eyebrow">${escape(lesson.category)} · ESTUDIO ${String(currentIndex+1).padStart(2,'0')}</p><h2 id="study-title">${escape(lesson.summary)}</h2><p>${escape(lesson.description)}</p></div>
      <blockquote class="anchor-verse reveal"><p>“${escape(lesson.anchor.text)}”</p><cite>${refLink(lesson.anchor.reference)}</cite></blockquote>
      <section id="historia" class="study-section reveal" aria-labelledby="story-title"><p class="section-label">01 · HISTORIA Y CONTEXTO</p><h2 id="story-title">${escape(lesson.storyTitle)}</h2><p class="story-lead">${escape(lesson.story)}</p><div class="story-timeline">${lesson.timeline.map((s,i)=>`<div class="story-step"><span class="step-index">${String(i+1).padStart(2,'0')}</span><h3>${escape(s.title)}</h3><p>${escape(s.text)}</p></div>`).join('')}</div></section>
      <section id="claves" class="study-section reveal" aria-labelledby="points-title"><p class="section-label">02 · LO ESENCIAL</p><h2 id="points-title">Ideas para llevar con vos.</h2><div class="point-grid">${lesson.points.map((p,i)=>`<div class="point-card"><span>${String(i+1).padStart(2,'0')}</span><h3>${escape(p.title)}</h3><p>${escape(p.text)}</p>${refLink(p.ref)}</div>`).join('')}</div>${extrasHTML(lesson)}</section>
      <section id="conclusion" class="study-section reveal" aria-labelledby="conclusion-title"><p class="section-label">03 · CONCLUSIÓN</p><div class="conclusion-panel"><h3 id="conclusion-title">${escape(lesson.conclusionTitle)}</h3><p>${escape(lesson.conclusion)}</p><div class="application"><span>PARA TU VIDA</span><p>${escape(lesson.application)}</p></div></div></section>
      <section id="referencias" class="study-section reveal" aria-labelledby="references-title"><p class="section-label">04 · VOLVÉ A LA PALABRA</p><div class="refs-heading"><h2 id="references-title">Pasajes de la clase.</h2><span>${lesson.references.length} REFERENCIAS</span></div><p class="reference-intro">Todos los pasajes citados en esta clase, reunidos en un lugar. Seleccioná uno para leerlo en la Biblia, versión Reina-Valera 1960.</p><div class="reference-grid">${lesson.references.map(r=>`<a class="reference-card" href="${passage(r.label)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(r.label)}: ${escape(r.topic)}. Se abre en otra pestaña"><strong>${escape(r.label)}</strong><span>${escape(r.topic)}</span></a>`).join('')}</div><p class="source-note">Los rangos de capítulos y las menciones generales se conservan tal como aparecen en la clase.</p></section>
      <div class="next-study"><div><p>OTRO ENCUENTRO CON LA PALABRA</p><h3>${escape(next.name)}</h3></div><button id="next-study-button">Explorar la clase</button></div>
    </div>
  </article>`;
}

function renderCatalog() {
  if (!lessons.length) { $('catalog-grid').innerHTML = '<p class="hg-catalog-empty">Próximamente. Estamos preparando nuevos estudios bíblicos para tu grupo.</p>'; return; }
  $('catalog-grid').innerHTML = lessons.map((l, i) => {
    const [atlas, cell] = l.art;
    const x = (cell % 3) * 50;
    const y = Math.floor(cell / 3) * 100;
    return `<button class="catalog-item" data-lesson="${i}" style="--tile-accent:${l.color}" aria-current="${i===currentIndex}"><span class="catalog-art" aria-hidden="true" style="background-image:url('atlas-${atlas}.webp');background-position:${x}% ${y}%"></span><span><span class="tile-number">${String(i+1).padStart(2,'0')} / ${lessons.length}</span><strong>${escape(l.name)}</strong><span class="tile-category">${escape(l.category)}</span></span></button>`;
  }).join('');
  $('catalog-grid').querySelectorAll('[data-lesson]').forEach(button=>button.addEventListener('click',()=>{dialog.close();navigate(Number(button.dataset.lesson));}));
}

function observeReading() {
  revealObserver?.disconnect();
  sectionObserver?.disconnect();
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));
  } else {
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {entry.target.classList.add('visible');revealObserver.unobserve(entry.target);}
    }), {threshold: .07});
    document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
  }
  if ('IntersectionObserver' in window) {
    sectionObserver = new IntersectionObserver(entries=>entries.forEach(entry=>{
      if (!entry.isIntersecting) return;
      document.querySelectorAll('.study-nav a').forEach(a=>a.classList.toggle('current',a.dataset.section===entry.target.id));
    }), {rootMargin:'-95px 0px -65% 0px',threshold:0});
    document.querySelectorAll('.study-section').forEach(el=>sectionObserver.observe(el));
  }
}

function render(animate = true) {
  const lesson = lessons[currentIndex];
  const rgb = lesson.color.slice(1).match(/.{2}/g).map(n=>parseInt(n,16)).join(',');
  document.documentElement.style.setProperty('--accent',lesson.color);
  document.documentElement.style.setProperty('--accent-rgb',rgb);
  document.title = 'Huellas · Estudios Bíblicos';
  document.querySelector('meta[name="theme-color"]').content = '#080e13';
  $('lesson-number').textContent = `${String(currentIndex+1).padStart(2,'0')} / ${lessons.length}`;
  $('lesson-category').textContent = lesson.category;
  $('lesson-name').textContent = lesson.name;
  $('hero-title').innerHTML = `${escape(lesson.headline[0])}<br><span class="accent-text">${escape(lesson.headline[1])}</span>`;
  $('hero-description').textContent = lesson.description;
  $('reading-time').textContent = `${lesson.minutes} min de lectura`;
  $('art-word').textContent = lesson.artWord;
  $('art-caption').textContent = lesson.artCaption;
  $('navigator-title').textContent = lesson.name;
  $('art-canvas').setAttribute('aria-label',`Ilustración geométrica: ${lesson.symbol}. ${lesson.artCaption}.`);
  $('lesson-dots').innerHTML = lessons.map((l,i)=>`<button class="${i===currentIndex?'active':''}" aria-label="Clase ${i+1}: ${escape(l.name)}" ${i===currentIndex?'aria-current="true"':''} data-index="${i}" title="${escape(l.name)}"></button>`).join('');
  $('lesson-dots').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>navigate(Number(button.dataset.index))));
  $('lesson-content').innerHTML = contentHTML(lesson);
  $('next-study-button').addEventListener('click',()=>navigate(currentIndex+1));
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('stage-copy').animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,easing:'cubic-bezier(.2,.7,.2,1)'});
    $('art-word').animate([{opacity:0},{opacity:1}],{duration:950});
  }
  art ||= new GeometryArt($('art-canvas'));
  art.setLesson(lesson);
  renderCatalog();
  observeReading();
  $('status').textContent = `Clase ${currentIndex+1} de ${lessons.length}: ${lesson.name}.`;
}

$('previous-lesson').addEventListener('click',()=>navigate(currentIndex-1));
$('next-lesson').addEventListener('click',()=>navigate(currentIndex+1));
$('explore-lesson').addEventListener('click',()=>{
  $('lesson-content').scrollIntoView({behavior:preferredScroll()});
  $('lesson-content').focus({preventScroll:true});
});
document.querySelector('.skip-link').addEventListener('click',event=>{
  event.preventDefault();
  $('lesson-content').scrollIntoView({behavior:preferredScroll()});
  $('lesson-content').focus({preventScroll:true});
});
$('scroll-lesson').addEventListener('click',()=>$('lesson-content').scrollIntoView({behavior:preferredScroll()}));
$('open-catalog').addEventListener('click',()=>dialog.showModal());
$('close-catalog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{
  if (event.target!==dialog) return;
  const r=dialog.getBoundingClientRect();
  if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close();
});

window.addEventListener('hashchange',()=>{
  if (!lessons.length) return;
  const route=parseRoute();
  const changed=route.index!==currentIndex;
  currentIndex=route.index;currentSection=route.section;
  if(changed){render();window.scrollTo({top:0,behavior:'instant'});}
  if(currentSection) requestAnimationFrame(()=>$(currentSection)?.scrollIntoView({behavior:preferredScroll()}));
  else if(!changed) window.scrollTo({top:0,behavior:preferredScroll()});
});
document.addEventListener('keydown',event=>{
  if (!lessons.length || $('huellas-app').hidden || $('huellas-app').inert) return;
  if(document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable]') || window.scrollY>window.innerHeight*.5) return;
  if(event.key==='ArrowRight'){event.preventDefault();navigate(currentIndex+1);}
  if(event.key==='ArrowLeft'){event.preventDefault();navigate(currentIndex-1);}
});
let touchStart;
$('art-stage').addEventListener('touchstart',e=>{touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
$('art-stage').addEventListener('touchend',e=>{
  if(!touchStart)return;
  const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;
  if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.6)navigate(currentIndex+(dx<0?1:-1));
  touchStart=null;
},{passive:true});

function update(nextLessons, study = {}) {
  if (!Array.isArray(nextLessons)) throw new Error('No pudimos cargar las clases.');
  lessons = nextLessons; touchStart = null;
  const empty = !lessons.length, name = study.groupName || 'Estudios Bíblicos';
  const label = study.collection?.label || 'Colección 2026';
  document.querySelector('.stage').hidden = empty;
  $('lesson-content').hidden = empty;
  document.querySelector('.skip-link').hidden = empty;
  $('group-empty').hidden = !empty;
  $('empty-group-name').textContent = name;
  $('study-group-label').textContent = name;
  $('header-collection').textContent = study.collection?.year || '2026';
  $('catalog-collection').textContent = `${name} · ${label}`;
  $('open-catalog').querySelector('span').textContent = lessons.length ? `${lessons.length === 1 ? 'La clase' : 'Las ' + lessons.length + ' clases'}` : 'Mis estudios';
  document.querySelector('.site-footer p').textContent = `${name} · ${label}`;
  for (const link of document.querySelectorAll('.brand,.footer-brand')) link.setAttribute('href', lessons.length ? '#' + lessons[0].id : '#');
  for (const id of ['previous-lesson', 'next-lesson']) $(id).disabled = lessons.length < 2;
  const route = parseRoute(); currentIndex = route.index; currentSection = route.section;
  const canonical = empty ? '' : '#' + lessons[currentIndex].id + (currentSection ? '/' + currentSection : '');
  if (location.hash !== canonical) history.replaceState(null, '', location.pathname + location.search + canonical);
  revealObserver?.disconnect(); sectionObserver?.disconnect();
  if (empty) {
    art?.stop(); $('lesson-content').replaceChildren(); $('lesson-dots').replaceChildren();
    renderCatalog(); $('status').textContent = `${name}. Próximamente habrá nuevos estudios.`;
  } else {
    render(false);
    if (currentSection) requestAnimationFrame(() => $(currentSection)?.scrollIntoView({ behavior: 'instant' }));
  }
}
mounted = { update };
update(initialLessons, initialStudy);
return mounted;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {fitArtWord,watchArtWord} from '../art-word-fit.js';

function fixture({width=330,word='CONVICCIÓN',baseSize=82,resizeObserver=true}={}) {
  const state={baseSize,fontFactor:.76,reads:0},stage={clientWidth:width};
  const style={fontSize:'',removeProperty(name){if(name==='font-size')this.fontSize='';}};
  const observers={text:[],size:[]},frames=new Map(),events=new Map(),fontEvents=new Map();let nextFrame=0,fontsReady;
  const add=(map,event,fn)=>{const set=map.get(event)||new Set();set.add(fn);map.set(event,set);};
  const fire=(map,event)=>{for(const fn of map.get(event)||[])fn();};
  const view={
    getComputedStyle:()=>({fontSize:style.fontSize||state.baseSize+'px'}),
    requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id;},
    cancelAnimationFrame:id=>frames.delete(id),
    addEventListener:(event,fn)=>add(events,event,fn),removeEventListener:(event,fn)=>events.get(event)?.delete(fn),
    MutationObserver:class{constructor(fn){this.fire=fn;observers.text.push(this);}observe(){}disconnect(){this.disconnected=true;}},
  };
  if(resizeObserver)view.ResizeObserver=class{constructor(fn){this.fire=fn;observers.size.push(this);}observe(){}disconnect(){this.disconnected=true;}};
  const fonts={ready:new Promise(resolve=>{fontsReady=resolve;}),addEventListener:(event,fn)=>add(fontEvents,event,fn),removeEventListener:(event,fn)=>fontEvents.get(event)?.delete(fn)};
  const element={textContent:word,style,parentElement:stage};
  const measured=()=>{
    const size=parseFloat(style.fontSize)||state.baseSize;
    return Math.max(0,Array.from(element.textContent).length*(size*state.fontFactor-2));
  };
  element.ownerDocument={defaultView:view,fonts,createRange:()=>({selectNodeContents(){},getBoundingClientRect(){state.reads++;return {width:measured()};}})};
  const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
  return {element,stage,state,frames,events,fontEvents,observers,fontsReady,flush,measured,resize:()=>fire(events,'resize'),fontLoaded:()=>fire(fontEvents,'loadingdone')};
}

test('long and accented words fit the available width without enlarging the design size',()=>{
  for(const word of ['ESPERANZA','CONVICCIÓN','AUTENTICIDAD','TRANSFORMACIÓN','UNA PALABRA MUCHO MÁS LARGA']){
    const f=fixture({word});fitArtWord(f.element);
    assert(f.measured()<=f.stage.clientWidth-4,word);assert(parseFloat(f.element.style.fontSize)<=f.state.baseSize,word);
  }
});
test('short words retain their original size and recover it after a longer class',()=>{
  const f=fixture();fitArtWord(f.element);assert(f.element.style.fontSize);
  f.element.textContent='FE';fitArtWord(f.element);assert.equal(f.element.style.fontSize,'');
  assert.equal(f.measured(),2*(82*.76-2));
});
test('narrowing and widening the stage recomputes the word from its original size',()=>{
  const f=fixture();fitArtWord(f.element);const small=parseFloat(f.element.style.fontSize);
  f.stage.clientWidth=220;fitArtWord(f.element);assert(parseFloat(f.element.style.fontSize)<small);assert(f.measured()<=216);
  f.stage.clientWidth=1200;fitArtWord(f.element);assert.equal(f.element.style.fontSize,'');
});
test('hidden or empty stages do not produce invalid sizes and fit correctly after becoming visible',()=>{
  const f=fixture({width:0});fitArtWord(f.element);assert.equal(f.state.reads,0);
  f.stage.clientWidth=330;fitArtWord(f.element);assert(f.measured()<=326);
  f.element.textContent='';fitArtWord(f.element);assert(!f.element.style.fontSize.includes('NaN'));
  assert.doesNotThrow(()=>fitArtWord(null));
});
test('class changes and repeated resize notifications share one scheduled measurement',()=>{
  const f=fixture(),stop=watchArtWord(f.element);f.flush();assert.equal(f.state.reads,1);
  f.element.textContent='AUTENTICIDAD';
  f.observers.text[0].fire();f.observers.size[0].fire();f.resize();f.resize();
  assert.equal(f.frames.size,1);f.flush();assert.equal(f.state.reads,2);assert(f.measured()<=326);
  f.element.textContent='RUT';f.observers.text[0].fire();f.flush();assert.equal(f.element.style.fontSize,'');stop();
});
test('font readiness and later font loading recompute glyph measurements',async()=>{
  const f=fixture(),stop=watchArtWord(f.element);f.flush();const before=parseFloat(f.element.style.fontSize);
  f.state.fontFactor=.95;f.fontsReady();await Promise.resolve();assert.equal(f.frames.size,1);f.flush();
  assert(parseFloat(f.element.style.fontSize)<before);assert(f.measured()<=326);
  f.state.fontFactor=.6;f.fontLoaded();f.flush();assert(f.measured()<=326);stop();
});
test('window resize handles font breakpoints even when the stage width stays fixed',()=>{
  const f=fixture({width:530}),stop=watchArtWord(f.element);f.flush();
  f.state.baseSize=170;f.resize();f.flush();assert(f.measured()<=526);
  f.state.baseSize=42;f.resize();f.flush();assert.equal(f.element.style.fontSize,'');stop();
});
test('window resize remains a fallback when ResizeObserver is unavailable',()=>{
  const f=fixture({resizeObserver:false}),stop=watchArtWord(f.element);f.flush();
  f.stage.clientWidth=210;f.resize();f.flush();assert(f.measured()<=206);stop();
});
test('disposing observers cancels queued work and ignores later font readiness',async()=>{
  const f=fixture(),stop=watchArtWord(f.element);assert.equal(f.frames.size,1);stop();
  assert.equal(f.frames.size,0);assert(f.observers.text[0].disconnected);assert(f.observers.size[0].disconnected);
  f.fontsReady();await Promise.resolve();f.resize();f.fontLoaded();assert.equal(f.frames.size,0);assert.equal(f.state.reads,0);
  assert.doesNotThrow(()=>watchArtWord(null)());
});

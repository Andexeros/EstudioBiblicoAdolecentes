// Original raster artwork is broken into animated triangular fragments in the browser.
// No network library, account, GPU extension or animation service is required.
const atlasCache = new Map();
const reducedMedia = matchMedia('(prefers-reduced-motion: reduce)');
const ease = t => 1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
const imageFor = letter => {
  if(!atlasCache.has(letter)) atlasCache.set(letter,new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Ilustración no disponible'));img.src=`atlas-${letter}.webp`;
  }));
  return atlasCache.get(letter);
};

export class GeometryArt {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
    this.width=1;this.height=1;this.target=null;this.old=null;this.ready=false;
    this.epoch=0;this.transitionStart=null;this.pointer={x:0,y:0};this.inView=true;this.frame=null;this.last=0;
    this.particles=Array.from({length:26},(_,i)=>({x:Math.sin(i*9.12)*.43,y:Math.cos(i*4.7)*.45,size:2+i%3,speed:.3+(i%7)*.14,seed:i*2.8}));
    this.resizeObserver=new ResizeObserver(()=>{this.resize();this.start();});this.resizeObserver.observe(canvas);
    if('IntersectionObserver' in window){this.visibilityObserver=new IntersectionObserver(([entry])=>{this.inView=entry.isIntersecting;if(this.inView)this.start();else this.stop();},{threshold:0});this.visibilityObserver.observe(canvas);}
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();else this.start();});
    canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=canvas.getBoundingClientRect();this.pointer={x:(e.clientX-r.left)/r.width-.5,y:(e.clientY-r.top)/r.height-.5};this.start();});
    canvas.addEventListener('pointerleave',()=>{this.pointer={x:0,y:0};this.start();});
    reducedMedia.addEventListener('change',()=>{this.stop();this.start();});
    this.resize();
  }
  resize(){
    const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;
    const dpr=Math.min(2,devicePixelRatio||1);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  async setLesson(lesson){
    const token=++this.epoch;this.color=lesson.color;this.ready=false;
    try{
      const [atlas,cell]=lesson.art;const img=await imageFor(atlas);if(token!==this.epoch)return;
      const source=this.extract(img,atlas,cell);this.old=this.target;this.target=source;this.transitionStart=null;this.ready=true;this.start();
    }catch{
      if(token!==this.epoch)return;
      this.old=null;this.target=null;this.ready=true;this.ctx.clearRect(0,0,this.width,this.height);
      this.ctx.font='16px Arial';this.ctx.fillStyle=this.color;this.ctx.textAlign='center';this.ctx.fillText(lesson.name,this.width/2,this.height/2);
    }
  }
  extract(img,atlas,cell){
    const tile=img.width/3,row=img.height/2;
    let sx=(cell%3)*tile,sy=Math.floor(cell/3)*row,sw=tile;
    if(atlas==='c' && cell===3)sw=548;
    if(atlas==='c' && cell===4){sx=548;sw=476;}
    const base=document.createElement('canvas');base.width=512;base.height=512;const c=base.getContext('2d',{willReadFrequently:true});
    c.drawImage(img,sx,sy,sw,row,0,0,512,512);
    // Fade barely visible atlas padding; leave the sculpture itself unchanged.
    c.globalCompositeOperation='destination-in';const fade=c.createRadialGradient(256,256,195,256,256,285);fade.addColorStop(0,'#fff');fade.addColorStop(1,'#fff0');c.fillStyle=fade;c.fillRect(0,0,512,512);c.globalCompositeOperation='source-over';
    const data=c.getImageData(0,0,512,512).data;
    const count=matchMedia('(max-width:720px)').matches?16:22,step=512/count;const shards=[];
    for(let y=0;y<count;y++)for(let x=0;x<count;x++)for(let half=0;half<2;half++){
      const px=Math.min(511,Math.floor((x+(half?.66:.33))*step)),py=Math.min(511,Math.floor((y+(half?.66:.33))*step));
      if(data[(py*512+px)*4+3]<8)continue;
      const piece=document.createElement('canvas');piece.width=Math.ceil(step+1);piece.height=Math.ceil(step+1);const pc=piece.getContext('2d');pc.beginPath();
      if(!half){pc.moveTo(0,0);pc.lineTo(step,0);pc.lineTo(0,step);}else{pc.moveTo(step,0);pc.lineTo(step,step);pc.lineTo(0,step);}
      pc.closePath();pc.clip();pc.drawImage(base,x*step,y*step,step+1,step+1,0,0,step+1,step+1);
      const seed=(x*43+y*71+half*113)%97;
      shards.push({image:piece,x:x*step,y:y*step,step,delay:(seed/97)*.22,dx:(x-count/2)*14+Math.sin(seed)*50,dy:(y-count/2)*14+Math.cos(seed)*50,rotate:Math.sin(seed)*1.8});
    }
    return {image:base,shards};
  }
  start(){
    // Cursor and resize events share the pending frame instead of postponing it.
    if(this.frame!==null||!this.inView||document.hidden||!this.ready||!this.target)return;
    this.frame=requestAnimationFrame(t=>this.draw(t));
  }
  stop(){
    if(this.frame!==null)cancelAnimationFrame(this.frame);
    this.frame=null;
  }
  draw(now){
    this.frame=null;
    if(!this.target||!this.inView||document.hidden)return;
    // Start the assembly clock only when its first frame can actually be drawn.
    if(this.transitionStart===null)this.transitionStart=now;
    const reduced=reducedMedia.matches,elapsed=(now-this.transitionStart)/1000;
    const ctx=this.ctx,w=this.width,h=this.height;
    ctx.clearRect(0,0,w,h);
    const size=Math.min(w*.92,h*.94),scale=size/512;
    const ox=(w-size)/2+this.pointer.x*13,oy=(h-size)/2-7+this.pointer.y*10+(reduced?0:Math.sin(now/1900)*5);
    // Quiet atmospheric geometry is intentionally secondary to the illustration.
    if(!reduced){ctx.fillStyle=this.color;this.particles.forEach(p=>{
      const x=w/2+p.x*w+Math.sin(now/3000*p.speed+p.seed)*11,y=h/2+p.y*h+Math.cos(now/2800*p.speed+p.seed)*8;
      ctx.globalAlpha=.12+(Math.sin(now/1700+p.seed)+1)*.08;ctx.beginPath();ctx.moveTo(x,y-p.size);ctx.lineTo(x+p.size,y+p.size);ctx.lineTo(x-p.size,y+p.size);ctx.closePath();ctx.fill();
    });ctx.globalAlpha=1;}
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
    if(reduced || elapsed>1.45){ctx.drawImage(this.target.image,0,0);this.old=null;}
    else{
      if(this.old){ctx.globalAlpha=Math.max(0,1-elapsed*3);ctx.drawImage(this.old.image,0,0);ctx.globalAlpha=1;}
      this.target.shards.forEach(s=>{
        const p=ease((elapsed-s.delay)/1.2),scatter=1-p;ctx.save();ctx.translate(s.x+s.step/2+s.dx*scatter,s.y+s.step/2+s.dy*scatter);ctx.rotate(s.rotate*scatter);ctx.globalAlpha=p;ctx.drawImage(s.image,-s.step/2,-s.step/2);ctx.restore();
      });
    }
    ctx.restore();ctx.globalAlpha=1;
    if(!reduced)this.start();
  }
}

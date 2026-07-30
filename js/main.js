'use strict';
let lenis;

/* ── LOADER ── */
(function(){
  const fill=document.getElementById('ld-fill');
  const pct=document.getElementById('ld-pct');
  const loader=document.getElementById('loader');
  if(!fill||!pct||!loader){initChatbotAndFloating();
  initChatbotAndFloatingControls();
  boot();return;}
  let v=0;
  const t=setInterval(()=>{
    v+=Math.random()*16+2;if(v>100)v=100;
    fill.style.width=v+'%';pct.textContent=Math.round(v)+'%';
    if(v>=100){clearInterval(t);setTimeout(()=>{
      gsap.to(loader,{opacity:0,duration:.6,ease:'power2.inOut',onComplete:()=>{loader.style.display='none';boot();}});
    },300);}
  },55);
})();

function boot(){
  gsap.registerPlugin(ScrollTrigger,ScrollToPlugin);
  initLenis();
  initCanvas();initCursor();initNavbar();
  initHeroIntro();initVideo();initScrollFx();
  initMap();initGallery();initMisc();
  initChatbotAndFloating();
  
  // Instant and delayed ScrollTrigger refreshes to prevent hidden sections on reload
  ScrollTrigger.refresh(true);
  setTimeout(() => ScrollTrigger.refresh(true), 150);
  setTimeout(() => ScrollTrigger.refresh(true), 600);
}

/* ── LENIS ── */
function initLenis(){
  lenis=new Lenis({lerp:.08,smoothWheel:true});
  gsap.ticker.add(t=>lenis.raf(t*1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll',ScrollTrigger.update);
  ScrollTrigger.scrollerProxy(document.body,{
    scrollTop(v){return arguments.length?lenis.scrollTo(v,{immediate:true}):lenis.scroll;},
    getBoundingClientRect(){return{top:0,left:0,width:window.innerWidth,height:window.innerHeight};}
  });
  /* scroll progress bar — using transform for GPU acceleration */
  const scrollBar=document.getElementById('scroll-bar');
  if(scrollBar){
    lenis.on('scroll',()=>{
      const prog=(lenis.scroll/((document.body.scrollHeight-window.innerHeight)||1));
      scrollBar.style.transform='scaleX('+prog+')';
    });
  }
}

/* ── CHEMISTRY CANVAS (UPGRADED) ── */
function initCanvas(){
  const cv=document.getElementById('chem-canvas');
  if(!cv)return;
  const ctx=cv.getContext('2d');
  let W=cv.width=window.innerWidth,H=cv.height=window.innerHeight;
  let resizePending=false;
  window.addEventListener('resize',()=>{
    if(!resizePending){resizePending=true;requestAnimationFrame(()=>{W=cv.width=window.innerWidth;H=cv.height=window.innerHeight;resizePending=false;});}
  });

  /* ── Palette ── */
  const gold='245,166,35';
  const amber='217,119,6';
  const warm='255,193,7';

  /* ── Element Symbols ── */
  const EL=['H','C','N','O','Na','Cl','Ca','K','Fe','Mg','S','P','Zn','Cu','Br','Li'];

  /* ── Floating Formulae ── */
  const FORMULAS=['H₂O','NaCl','CO₂','H₂SO₄','CaCO₃','CH₄','NH₃','HCl','C₆H₁₂O₆','Fe₂O₃'];

  /* ── Reaction Products (shown when atoms "react") ── */
  const REACTIONS={
    'H+O':'H₂O','Na+Cl':'NaCl','C+O':'CO₂','H+Cl':'HCl',
    'Ca+O':'CaO','Fe+O':'Fe₂O₃','H+N':'NH₃','C+H':'CH₄',
    'Mg+O':'MgO','K+Cl':'KCl','Na+O':'Na₂O','S+O':'SO₂',
    'Cu+S':'CuS','Zn+O':'ZnO','Li+O':'Li₂O','Ca+Cl':'CaCl₂'
  };

  /* ── Atoms ── */
  const atomCount=Math.min(Math.floor(W*H/48000),18);
  const atoms=Array.from({length:atomCount},()=>{
    const baseSpeed=0.12+Math.random()*0.1;
    const angle=Math.random()*Math.PI*2;
    return {
      x:Math.random()*W,y:Math.random()*H,
      r:10+Math.random()*10,
      vx:Math.cos(angle)*baseSpeed,
      vy:Math.sin(angle)*baseSpeed,
      el:EL[Math.floor(Math.random()*EL.length)],
      oR:16+Math.random()*14,
      oR2:20+Math.random()*10,
      oS:(Math.random()>.5?1:-1)*(.003+Math.random()*.005),
      oA:Math.random()*Math.PI*2,
      a:.18+Math.random()*.12,
      phase:Math.random()*Math.PI*2,
      driftAmp:0.3+Math.random()*0.4,
      pulsePhase:Math.random()*Math.PI*2,
      pulseSpeed:.008+Math.random()*.012,
    };
  });

  /* ── Floating formulae ── */
  const formulaCount=Math.min(Math.floor(W*H/120000),6);
  const formulae=Array.from({length:formulaCount},()=>({
    x:Math.random()*W,y:Math.random()*H,
    vx:(Math.random()-.5)*.06,
    vy:-0.04-Math.random()*.04,
    text:FORMULAS[Math.floor(Math.random()*FORMULAS.length)],
    a:.06+Math.random()*.06,
    size:11+Math.random()*5,
    phase:Math.random()*Math.PI*2,
  }));

  /* ── Reaction effects pool ── */
  const reactions=[];  // {x,y,life,maxLife,product,sparks[]}
  const REACT_DIST=35; // atoms must be this close to react
  const reactionCooldowns=new Map(); // prevent spam: "i-j" -> cooldown timer

  function spawnReaction(x,y,product){
    const sparkCount=6+Math.floor(Math.random()*4);
    const sparks=[];
    for(let s=0;s<sparkCount;s++){
      const ang=Math.random()*Math.PI*2;
      const spd=0.6+Math.random()*1.2;
      sparks.push({x:0,y:0,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life:1});
    }
    reactions.push({x,y,life:1,maxLife:1,product,sparks,ringR:0});
  }

  const BD=140;
  let canvasVisible=true;
  let animFrameId=null;
  let t=0;

  function draw(){
    if(!canvasVisible)return;
    t+=0.016;
    ctx.clearRect(0,0,W,H);

    /* ── 1. Move atoms ── */
    atoms.forEach(a=>{
      a.x+=a.vx+Math.sin(t*0.5+a.phase)*a.driftAmp*0.08;
      a.y+=a.vy+Math.cos(t*0.4+a.phase)*a.driftAmp*0.06;
      if(a.x<-60)a.x=W+60;if(a.x>W+60)a.x=-60;
      if(a.y<-60)a.y=H+60;if(a.y>H+60)a.y=-60;
      a.oA+=a.oS;
      a.pulsePhase+=a.pulseSpeed;
    });

    /* ── 2. Bond network + reaction detection ── */
    for(let i=0;i<atoms.length;i++){
      for(let j=i+1;j<atoms.length;j++){
        const dx=atoms[j].x-atoms[i].x,dy=atoms[j].y-atoms[i].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<BD){
          const strength=(1-d/BD);
          ctx.beginPath();
          ctx.moveTo(atoms[i].x,atoms[i].y);
          ctx.lineTo(atoms[j].x,atoms[j].y);
          ctx.strokeStyle=`rgba(${gold},${strength*.12})`;
          ctx.lineWidth=0.7+strength*0.4;
          ctx.stroke();

          // Double bond for close atoms
          if(d<BD*0.5){
            const nx=-dy/d*2.5,ny=dx/d*2.5;
            ctx.beginPath();
            ctx.moveTo(atoms[i].x+nx,atoms[i].y+ny);
            ctx.lineTo(atoms[j].x+nx,atoms[j].y+ny);
            ctx.strokeStyle=`rgba(${amber},${strength*.06})`;
            ctx.lineWidth=0.4;
            ctx.stroke();
          }

          // ── Chemical reaction trigger ──
          if(d<REACT_DIST){
            const key=i+'-'+j;
            if(!reactionCooldowns.has(key)){
              const pair1=atoms[i].el+'+'+atoms[j].el;
              const pair2=atoms[j].el+'+'+atoms[i].el;
              const product=REACTIONS[pair1]||REACTIONS[pair2];
              const mx=(atoms[i].x+atoms[j].x)/2;
              const my=(atoms[i].y+atoms[j].y)/2;
              spawnReaction(mx,my,product||'⚡');

              // Bounce atoms apart gently
              const repel=0.3;
              atoms[i].vx-=(dx/d)*repel;atoms[i].vy-=(dy/d)*repel;
              atoms[j].vx+=(dx/d)*repel;atoms[j].vy+=(dy/d)*repel;

              // Cooldown so same pair doesn't react every frame
              reactionCooldowns.set(key,180);
            }
          }
        }
      }
    }

    // Tick cooldowns
    for(const [key,val] of reactionCooldowns){
      if(val<=1)reactionCooldowns.delete(key);
      else reactionCooldowns.set(key,val-1);
    }

    /* ── 3. Draw atoms ── */
    atoms.forEach(a=>{
      const pulse=0.85+Math.sin(a.pulsePhase)*0.15;
      const drawA=a.a*pulse;

      // Glow halo
      const grad=ctx.createRadialGradient(a.x,a.y,a.r*0.5,a.x,a.y,a.r*2.8);
      grad.addColorStop(0,`rgba(${gold},${drawA*.18})`);
      grad.addColorStop(1,`rgba(${gold},0)`);
      ctx.beginPath();
      ctx.arc(a.x,a.y,a.r*2.8,0,Math.PI*2);
      ctx.fillStyle=grad;
      ctx.fill();

      // Atom circle
      ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${gold},${drawA})`;ctx.lineWidth=1;ctx.stroke();

      // Element symbol
      ctx.font=`bold ${Math.round(a.r*.65)}px 'Plus Jakarta Sans',sans-serif`;
      ctx.fillStyle=`rgba(${gold},${drawA*.9})`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(a.el,a.x,a.y);

      // Primary orbital
      ctx.beginPath();
      ctx.ellipse(a.x,a.y,a.oR,a.oR*.38,a.oA*.3,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${gold},${drawA*.4})`;ctx.lineWidth=0.5;ctx.stroke();

      // Secondary orbital
      ctx.beginPath();
      ctx.ellipse(a.x,a.y,a.oR2,a.oR2*.32,a.oA*.3+Math.PI*0.5,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${amber},${drawA*.22})`;ctx.lineWidth=0.4;ctx.stroke();

      // Electron on primary orbital
      const ex=a.x+Math.cos(a.oA)*a.oR;
      const ey=a.y+Math.sin(a.oA)*a.oR*.38;
      ctx.beginPath();ctx.arc(ex,ey,2,0,Math.PI*2);
      ctx.fillStyle=`rgba(${warm},${drawA})`;ctx.fill();

      // Electron on secondary orbital
      const ex2=a.x+Math.cos(-a.oA*1.3)*a.oR2;
      const ey2=a.y+Math.sin(-a.oA*1.3)*a.oR2*.32;
      ctx.beginPath();ctx.arc(ex2,ey2,1.5,0,Math.PI*2);
      ctx.fillStyle=`rgba(${warm},${drawA*.75})`;ctx.fill();
    });

    /* ── 4. Reaction effects ── */
    for(let r=reactions.length-1;r>=0;r--){
      const rx=reactions[r];
      rx.life-=0.012;
      rx.ringR+=1.2;
      if(rx.life<=0){reactions.splice(r,1);continue;}

      // Expanding ring
      ctx.beginPath();
      ctx.arc(rx.x,rx.y,rx.ringR,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${warm},${rx.life*0.25})`;
      ctx.lineWidth=1.2*rx.life;
      ctx.stroke();

      // Inner flash glow
      const flashGrad=ctx.createRadialGradient(rx.x,rx.y,0,rx.x,rx.y,rx.ringR*0.6);
      flashGrad.addColorStop(0,`rgba(${warm},${rx.life*0.12})`);
      flashGrad.addColorStop(1,`rgba(${warm},0)`);
      ctx.beginPath();
      ctx.arc(rx.x,rx.y,rx.ringR*0.6,0,Math.PI*2);
      ctx.fillStyle=flashGrad;
      ctx.fill();

      // Sparks flying outward
      rx.sparks.forEach(s=>{
        s.x+=s.vx;s.y+=s.vy;
        s.vx*=0.97;s.vy*=0.97;
        s.life-=0.015;
        if(s.life>0){
          ctx.beginPath();
          ctx.arc(rx.x+s.x,rx.y+s.y,1.2*s.life,0,Math.PI*2);
          ctx.fillStyle=`rgba(${warm},${s.life*0.5})`;
          ctx.fill();
        }
      });

      // Product formula text floating up
      if(rx.life>0.3){
        const textA=(rx.life-0.3)/0.7*0.2;
        const yOff=-rx.ringR*0.4;
        ctx.font=`bold 12px 'Plus Jakarta Sans',sans-serif`;
        ctx.fillStyle=`rgba(${warm},${textA})`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(rx.product,rx.x,rx.y+yOff);
      }
    }

    /* ── 5. Floating formulae ── */
    formulae.forEach(f=>{
      f.x+=f.vx+Math.sin(t*0.3+f.phase)*0.15;
      f.y+=f.vy;
      if(f.y<-30){f.y=H+30;f.x=Math.random()*W;}
      if(f.x<-60)f.x=W+60;if(f.x>W+60)f.x=-60;

      const fadeA=f.a*(0.7+Math.sin(t*0.8+f.phase)*0.3);
      ctx.font=`${Math.round(f.size)}px 'Plus Jakarta Sans',sans-serif`;
      ctx.fillStyle=`rgba(${gold},${fadeA})`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(f.text,f.x,f.y);
    });

    animFrameId=requestAnimationFrame(draw);
  }
  draw();
}

/* ── CURSOR ── */
function initCursor(){
  if(window.matchMedia('(pointer:coarse)').matches)return;
  const dot=document.getElementById('cursor-dot');
  const ring=document.getElementById('cursor-ring');
  if(!dot||!ring)return;
  const xD=gsap.quickTo(dot,'x',{duration:.1,ease:'power3'}),yD=gsap.quickTo(dot,'y',{duration:.1,ease:'power3'});
  const xR=gsap.quickTo(ring,'x',{duration:.32,ease:'power2'}),yR=gsap.quickTo(ring,'y',{duration:.32,ease:'power2'});
  window.addEventListener('mousemove',e=>{xD(e.clientX);yD(e.clientY);xR(e.clientX);yR(e.clientY);});
  document.querySelectorAll('a,button,.gal-item,.tg-card').forEach(el=>{
    el.addEventListener('mouseenter',()=>{gsap.to(ring,{width:54,height:54,borderColor:'var(--primary)',duration:.22});gsap.to(dot,{width:10,height:10,background:'var(--primary)',duration:.18});});
    el.addEventListener('mouseleave',()=>{gsap.to(ring,{width:40,height:40,borderColor:'var(--primary)',duration:.28});gsap.to(dot,{width:8,height:8,background:'var(--primary)',duration:.18});});
  });
}

/* ── NAVBAR ── */
function initNavbar(){
  const pill=document.getElementById('nav-pill');
  if(!pill)return;
  const nsb=document.getElementById('nsb'),nsc=document.getElementById('nsc'),nsi=document.getElementById('ns-input');
  const ham = document.getElementById('nav-ham');
  const navLinks = document.getElementById('nav-links');
  let sm = false;

  function openS(){
    sm = true;
    pill.classList.add('sm');
    document.getElementById('search-shade')?.classList.add('vis');
    gsap.fromTo('#nav-sx',{opacity:0,x:8},{opacity:1,x:0,duration:.25});
    if(nsi)setTimeout(()=>nsi.focus(),100);
  }

  function closeS(){
    if(!sm)return;
    sm=false;
    document.getElementById('search-shade')?.classList.remove('vis');
    gsap.to('#nav-sx',{opacity:0,x:-8,duration:.2,onComplete:()=>pill.classList.remove('sm')});
  }

  if(nsb)nsb.addEventListener('click',openS);
  if(nsc)nsc.addEventListener('click',closeS);

  /* Mobile Hamburger Menu */
  if (ham && navLinks) {
    ham.addEventListener('click', (e) => {
      e.stopPropagation();
      ham.classList.toggle('active');
      navLinks.classList.toggle('open');
    });

    // Close mobile nav when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        ham.classList.remove('active');
        navLinks.classList.remove('open');
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !ham.contains(e.target)) {
        ham.classList.remove('active');
        navLinks.classList.remove('open');
      }
    });
  }

  /* Centralized keyboard handler */
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeS();
      if(ham && navLinks){
        ham.classList.remove('active');
        navLinks.classList.remove('open');
      }
      /* Close lightbox too */
      const lb=document.getElementById('lb');
      if(lb&&lb.classList.contains('open')){
        gsap.to('.lb-in',{scale:.85,opacity:0,duration:.22,onComplete:()=>lb.classList.remove('open')});
      }
    }
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openS();}
  });

  /* Active link tracking — pre-cache section offsets */
  const secs=document.querySelectorAll('section[id]');
  const nls=document.querySelectorAll('.nav-links a');
  let secOffsets=[];
  function cacheSectionOffsets(){
    secOffsets=Array.from(secs).map(sec=>({
      id:sec.id,
      top:sec.offsetTop,
      height:sec.offsetHeight
    }));
  }
  cacheSectionOffsets();
  window.addEventListener('resize',()=>requestAnimationFrame(cacheSectionOffsets));

  const navbar = document.getElementById('navbar');
  let lastScrollY = 0;

  lenis.on('scroll', () => {
    const sy = lenis.scroll || 0;

    /* Section active tracking */
    secOffsets.forEach(sec => {
      if (sy >= sec.top - 130 && sy < sec.top + sec.height - 130)
        nls.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + sec.id));
    });

    /* Smart navbar hide/show on scroll direction */
    if (navbar) {
      const heroHeight = document.getElementById('hero')?.offsetHeight || 500;
      if (sy <= 100) {
        navbar.classList.remove('nav-hidden');
        navbar.classList.add('nav-visible');
      } else if (sy > lastScrollY && sy > heroHeight - 150) {
        // Scrolling DOWN past video -> Hide
        navbar.classList.add('nav-hidden');
        navbar.classList.remove('nav-visible');
      } else if (sy < lastScrollY) {
        // Scrolling UP -> Reveal
        navbar.classList.remove('nav-hidden');
        navbar.classList.add('nav-visible');
      }
    }
    lastScrollY = sy;
  });
}

/* ── HERO INTRO ── */
function initHeroIntro(){
  gsap.set('#hero-c',{opacity:0});
  gsap.set(['#hk','#hg','#hcta'],{opacity:0,y:20});
  gsap.set('.li',{y:60});

  let introPlayed = false;
  const tl=gsap.timeline({paused:true});
  tl.to('#hero-c',{opacity:1,duration:.4})
    .to('#hk',{opacity:1,y:0,duration:.55,ease:'power3.out'},'<')
    .to('.li',{y:0,duration:.75,stagger:.13,ease:'power4.out'},'-=.3')
    .to('#hg',{opacity:1,y:0,duration:.55,ease:'power3.out'},'-=.3')
    .to('#hcta',{opacity:1,y:0,duration:.5,ease:'power3.out'},'-=.25');

  const ctr=(id,end,delay)=>{
    const el=document.getElementById(id);
    if(!el)return;
    const obj = {v: 0};
    gsap.to(obj, {v:end,duration:2,delay,ease:'power2.out',onUpdate:()=>{el.textContent=Math.round(obj.v);}});
  };

  function playIntro(){
    if(introPlayed)return;
    introPlayed = true;
    tl.play();
    ctr('c1',2228,.9);
    ctr('c2',4,.9);
    ctr('c3',42,.9);

    const nb=document.getElementById('navbar');
    if(nb){
      setTimeout(()=>{
        nb.classList.add('ready');
        gsap.fromTo('#navbar',{opacity:0},{opacity:1,duration:.65,ease:'power3.out'});
      },1000);
    }
    const hl=document.getElementById('floating-hotline');
    if(hl){
      setTimeout(()=>{
        hl.classList.add('on');
        gsap.fromTo('#floating-hotline',{x:24,opacity:0},{x:0,opacity:1,duration:.55,ease:'power3.out'});
      },1600);
    }
    setTimeout(()=>gsap.to('#scroll-hint',{opacity:1,duration:.5}),2000);
  }

  /* Play after 1.5s */
  let introTimer = setTimeout(playIntro, 1500);

  /* Or play immediately if scrolled */
  let scrollHintHidden = false;
  lenis.on('scroll',()=>{
    const sy = lenis.scroll || 0;
    if(!introPlayed && sy > 10) {
      clearTimeout(introTimer);
      playIntro();
    }
    if(!scrollHintHidden && sy > 60){
      scrollHintHidden=true;
      gsap.to('#scroll-hint',{opacity:0,duration:.3});
    }
  });
}

/* ── VIDEO SCRUB ── */
function initVideo(){
  const vid=document.getElementById('hero-video');
  if(!vid)return;
  
  /* Ensure cinematic autoplay on load */
  vid.autoplay = true;
  vid.loop = true;
  vid.play().catch(()=>{});

  /* Pause video when out of view to save performance */
  ScrollTrigger.create({
    trigger:'#hero',
    start:'top top',
    end:'bottom top',
    onLeave:()=>{ if(!vid.paused) vid.pause(); },
    onEnterBack:()=>{ vid.play().catch(()=>{}); }
  });
}

/* ── SCROLL ANIMATIONS ── */
function initScrollFx(){
  [['#ab-img','#ab-col'],['#proc-hd'],['#tg-hd'],['#gal-hd'],['#ct-info'],['#ct-form-col']].forEach(ids=>{
    ids.forEach(id=>{
      const el = document.querySelector(id);
      if(!el) return;
      
      // If element is already in or past viewport on load (e.g. page reloaded at section), show immediately
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.95;
      
      gsap.fromTo(el,
        { opacity: inView ? 1 : 0, y: inView ? 0 : 36 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            toggleActions: 'play none none none'
          }
        }
      );
    });
  });

  /* Process horizontal scroll pinning */
  initProcessScroll();

  /* telegram cards */
  document.querySelectorAll('.tg-card').forEach((el,i)=>{
    gsap.fromTo(el,{opacity:0,y:32},{opacity:1,y:0,duration:.6,delay:i*.1,ease:'power3.out',
      scrollTrigger:{trigger:'.tg-grid',start:'top 85%',toggleActions:'play none none none'}
    });
  });

  /* gallery items initial reveal - moved to initGallery */

  /* about image parallax */
  if(document.querySelector('.ab-frame img')){
    gsap.to('.ab-frame img',{yPercent:-7,ease:'none',
      scrollTrigger:{trigger:'#about',start:'top bottom',end:'bottom top',scrub:2}
    });
  }

  /* back-to-top visibility */
  const backTop=document.getElementById('back-to-top');
  if(backTop){
    ScrollTrigger.create({start:'top -200',onEnter:()=>backTop.classList.add('vis'),onLeaveBack:()=>backTop.classList.remove('vis')});
  }
}

/* ── MAP ── */
function initMap(){
  const svg=document.getElementById('sl-map');
  const tip=document.getElementById('map-tip');
  if(!svg||!tip)return;
  const cont=document.getElementById('cen-map');
  if(!cont)return;

  svg.querySelectorAll('.mpin').forEach(pin=>{
    const name=pin.getAttribute('data-n'),url=pin.getAttribute('data-m');
    const po=pin.querySelector('.po');
    if(!po)return;

    function showTip(){
      tip.textContent=name;
      tip.classList.add('vis');
      const sr=svg.getBoundingClientRect(),cr=cont.getBoundingClientRect();
      const cx=parseFloat(po.getAttribute('cx')),cy=parseFloat(po.getAttribute('cy'));
      const sx=sr.width/449.69,sy2=sr.height/792.55;
      let left=(cx*sx+sr.left-cr.left);
      let top2=(cy*sy2+sr.top-cr.top-14);
      const tw=tip.offsetWidth||140;
      left=Math.max(tw/2+10,Math.min(cr.width-tw/2-10,left));
      top2=Math.max(30,Math.min(cr.height-10,top2));
      tip.style.left=left+'px';
      tip.style.top=top2+'px';
    }
    function hideTip(){
      tip.classList.remove('vis');
    }

    pin.addEventListener('mouseenter',showTip);
    pin.addEventListener('mouseleave',hideTip);
    pin.addEventListener('touchstart',e=>{e.preventDefault();showTip();},{passive:false});
    pin.addEventListener('touchend',()=>{setTimeout(hideTip,1500);});
    pin.addEventListener('click',()=>url&&window.open(url,'_blank','noopener,noreferrer'));
  });
}

/* ── GALLERY ── */
function initGallery(){
  let limit = window.innerWidth <= 600 ? 4 : 8;
  let expanded = false;
  let initialRevealDone = false;

  function updateGalleryDisplay() {
    const activeBtn = document.querySelector('.flt-btn.act');
    if(!activeBtn) return;
    const f = activeBtn.getAttribute('data-f');
    let visibleCount = 0;
    
    document.querySelectorAll('.gal-item').forEach((item, i) => {
      const matchesFilter = f === 'all' || item.getAttribute('data-c') === f;
      
      if (matchesFilter) {
        if (!expanded && visibleCount >= limit) {
          // Hide because of limit
          gsap.to(item,{opacity:0,scale:.92,duration:.28,overwrite:'auto', onComplete:()=>item.classList.add('gone')});
        } else {
          // Show
          if (!initialRevealDone && document.getElementById('gal-grid')) {
            // First time reveal uses scrollTrigger
            gsap.fromTo(item,{opacity:0,scale:.94},{opacity:1,scale:1,duration:.55,delay:(visibleCount%4)*.08,ease:'power2.out',
              scrollTrigger:{trigger:'#gal-grid',start:'top 85%',toggleActions:'play none none none'},
              onStart:()=>item.classList.remove('gone')
            });
          } else {
            // Normal filter show
            gsap.to(item,{opacity:1,scale:1,duration:.28,overwrite:'auto', onStart:()=>item.classList.remove('gone')});
          }
        }
        visibleCount++;
      } else {
        // Hide because of filter
        gsap.to(item,{opacity:0,scale:.92,duration:.28,overwrite:'auto', onComplete:()=>item.classList.add('gone')});
      }
    });

    initialRevealDone = true;

    const loadMoreBtn = document.getElementById('gal-load-more');
    if(loadMoreBtn) {
      if(visibleCount > limit && !expanded) {
        loadMoreBtn.style.display = 'inline-flex';
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }
    setTimeout(() => ScrollTrigger.refresh(), 350);
  }

  updateGalleryDisplay();

  document.querySelectorAll('.flt-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.flt-btn').forEach(b=>b.classList.remove('act'));
      btn.classList.add('act');
      expanded = false; 
      updateGalleryDisplay();
    });
  });

  const loadMoreBtn = document.getElementById('gal-load-more');
  if(loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      expanded = true;
      updateGalleryDisplay();
    });
  }
  const lb=document.getElementById('lb');
  const lbI=document.getElementById('lb-img');
  const lbX=document.getElementById('lb-x');
  if(!lb||!lbI)return;

  document.querySelectorAll('.gal-item').forEach(it=>{
    it.addEventListener('click',()=>{
      const img=it.querySelector('img');
      if(!img)return;
      lbI.src=img.src;lb.classList.add('open');
      gsap.fromTo('.lb-in',{scale:.85,opacity:0},{scale:1,opacity:1,duration:.32,ease:'back.out(1.5)'});
    });
  });
  function closeLb(){gsap.to('.lb-in',{scale:.85,opacity:0,duration:.22,onComplete:()=>lb.classList.remove('open')});}
  if(lbX)lbX.addEventListener('click',closeLb);
  lb.addEventListener('click',e=>{if(e.target===lb)closeLb();});
  /* Escape key handled in centralized handler in initNavbar */
}

/* ── MISC ── */
function initMisc(){

  const dtOverlay = document.getElementById('desktop-only-overlay');
  const dtDismiss = document.getElementById('dt-dismiss-btn');
  if (dtOverlay && dtDismiss) {
    dtDismiss.addEventListener('click', () => {
      dtOverlay.classList.add('dismissed');
    });
  }

  /* Back top click */
  const backTop=document.getElementById('back-to-top');
  if(backTop)backTop.addEventListener('click',()=>lenis&&lenis.scrollTo(0,{duration:1.2}));
  /* Contact form */
  document.getElementById('ct-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const b=e.target.querySelector('button[type=submit]');
    if(!b)return;
    const o=b.innerHTML;
    b.innerHTML='<i class="fas fa-check"></i> Sent!';b.style.background='linear-gradient(135deg,#10b981,#059669)';
    setTimeout(()=>{b.innerHTML=o;b.style.background='';},3000);
  });
  /* Smooth anchor links */
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const href=a.getAttribute('href');
      if(!href||href==='#')return;
      try{
        const t=document.querySelector(href);
        if(t){e.preventDefault();lenis&&lenis.scrollTo(t,{duration:.95,easing:x=>Math.sin((x*Math.PI)/2)});}
      }catch(err){/* invalid selector, ignore */}
    });
  });
}

/* ── PROCESS STEP-BY-STEP PINNED REVEAL ── */
function initProcessScroll() {
  const processSec = document.getElementById('process');
  const lineFill = document.getElementById('proc-line-fill');
  const items = document.querySelectorAll('.proc-item');

  if (!processSec || items.length === 0) return;

  const isMobile = window.innerWidth <= 992;

  ScrollTrigger.create({
    trigger: processSec,
    pin: !isMobile,
    start: isMobile ? 'top 75%' : 'top 4%',
    end: isMobile ? 'bottom 60%' : '+=1100',
    scrub: 0.8,
    invalidateOnRefresh: true,
    onRefresh: () => {
      if (isMobile && items.length > 0) {
        const lineBg = document.querySelector('.proc-line-bg');
        const grid = document.querySelector('.proc-grid');
        const lastItem = items[items.length - 1];
        const lastNode = lastItem ? lastItem.querySelector('.proc-node') : null;
        if (lineBg && grid && lastNode) {
          const gridTop = grid.getBoundingClientRect().top;
          const nodeCenter = lastNode.getBoundingClientRect().top + (lastNode.offsetHeight / 2);
          // Set lineBg to span exactly from top:48px down to the center of the last node
          lineBg.style.bottom = 'auto';
          lineBg.style.height = (nodeCenter - gridTop - 48) + 'px';
        }
      } else {
        const lineBg = document.querySelector('.proc-line-bg');
        if(lineBg) {
          lineBg.style.height = '';
          lineBg.style.bottom = '';
        }
      }
    },
    onUpdate: (self) => {
      const prog = self.progress;

      // Animate connecting timeline bar
      if (lineFill) {
        if (isMobile) {
          lineFill.style.height = (prog * 100) + '%';
          lineFill.style.width = '100%';
        } else {
          lineFill.style.width = (prog * 100) + '%';
          lineFill.style.height = '100%';
        }
      }

      // Step threshold reveals (Step 1 is active by default at start)
      const totalSteps = items.length;
      items.forEach((item, idx) => {
        if (idx === 0) {
          item.classList.add('active');
          return;
        }
        const threshold = (idx) / (totalSteps - 0.7);
        if (prog >= threshold) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  });

  // Clicking node scrolls directly to that step's scroll position
  items.forEach((item, idx) => {
    item.addEventListener('click', () => {
      const st = ScrollTrigger.getAll().find(s => s.trigger === processSec);
      if (!st) return;
      const targetScroll = st.start + (st.end - st.start) * (idx / (items.length - 1));
      lenis ? lenis.scrollTo(targetScroll, { duration: 0.8 }) : window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    });
  });
}

/* ── FLOATING HOTLINE, BACK-TO-TOP & ECHEMBOT AI CHATBOT ── */
function initChatbotAndFloating() {
  const hotline = document.getElementById('floating-hotline');
  const topBtn = document.getElementById('back-to-top');
  const cbTrigger = document.getElementById('chat-trigger');
  const cbWindow = document.getElementById('chat-modal');
  const cbClose = document.getElementById('chat-close');
  const cbForm = document.getElementById('bot-form');
  const cbInput = document.getElementById('bot-input');
  const cbBody = document.getElementById('bot-body');

  // Scroll listener: Hotline visible ONLY at very top (scrollPos <= 25px), disappears instantly when scrolling down
  const updateScrollBadges = () => {
    const scrollPos = window.scrollY || window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;

    if (scrollPos > 25) {
      document.body.classList.add('scrolled-down');
      if (hotline) hotline.classList.add('hide');
    } else {
      document.body.classList.remove('scrolled-down');
      if (hotline) hotline.classList.remove('hide');
    }

    if (topBtn) {
      if (scrollPos > 350) {
        topBtn.classList.add('vis');
      } else {
        topBtn.classList.remove('vis');
      }
    }
  };

  window.addEventListener('scroll', updateScrollBadges, { passive: true });
  if (window.lenis) {
    window.lenis.on('scroll', updateScrollBadges);
  }
  updateScrollBadges();

  // Back to top scroll handler
  if (topBtn) {
    topBtn.addEventListener('click', () => {
      if (window.lenis) {
        window.lenis.scrollTo(0);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Chatbot toggle handler
  if (cbTrigger && cbWindow) {
    cbTrigger.addEventListener('click', () => {
      const isOpen = cbWindow.classList.contains('open');
      if (isOpen) {
        cbWindow.classList.remove('open');
        cbTrigger.classList.remove('active');
      } else {
        cbWindow.classList.add('open');
        cbTrigger.classList.add('active');
      }
    });
  }

  if (cbClose && cbWindow) {
    cbClose.addEventListener('click', () => {
      cbWindow.classList.remove('open');
      if (cbTrigger) cbTrigger.classList.remove('active');
    });
  }

  // Quick Action Pills
  document.querySelectorAll('.bot-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const q = pill.getAttribute('data-q');
      if (!q || !cbBody) return;
      
      // Append user query bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'user-msg';
      userBubble.textContent = pill.textContent;
      cbBody.appendChild(userBubble);

      // Append bot response
      setTimeout(() => {
        const botCard = document.createElement('div');
        botCard.className = 'bot-msg-card';
        botCard.innerHTML = `<p>${q}</p><span class="bot-time">Just now</span>`;
        cbBody.appendChild(botCard);
        cbBody.scrollTop = cbBody.scrollHeight;
      }, 350);

      cbBody.scrollTop = cbBody.scrollHeight;
    });
  });

  // Form submit handler
  if (cbForm && cbInput && cbBody) {
    cbForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = cbInput.value.trim();
      if (!txt) return;

      const userBubble = document.createElement('div');
      userBubble.className = 'user-msg';
      userBubble.textContent = txt;
      cbBody.appendChild(userBubble);
      cbInput.value = '';

      setTimeout(() => {
        const botCard = document.createElement('div');
        botCard.className = 'bot-msg-card';
        botCard.innerHTML = `<p>Thank you for your question! For detailed information regarding "<strong>${txt}</strong>", please call our hotline <strong>070 424 4444</strong> or visit your nearest exam center.</p><span class="bot-time">Just now</span>`;
        cbBody.appendChild(botCard);
        cbBody.scrollTop = cbBody.scrollHeight;
      }, 450);

      cbBody.scrollTop = cbBody.scrollHeight;
    });
  }
}

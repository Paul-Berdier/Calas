import {gsap} from 'gsap';
import type {ScrollTrigger as ScrollTriggerInstance} from 'gsap/ScrollTrigger';
import {coilState,coilDuration} from '../../../../assets/brand/coil.mjs';

let scrollTriggerModule:typeof import('gsap/ScrollTrigger').ScrollTrigger|undefined;
let scrollTriggerLoading:Promise<typeof import('gsap/ScrollTrigger').ScrollTrigger>|undefined;
const ensureScrollTrigger=()=>scrollTriggerLoading??=import('gsap/ScrollTrigger').then(({ScrollTrigger})=>{
 gsap.registerPlugin(ScrollTrigger);scrollTriggerModule=ScrollTrigger;return ScrollTrigger;
});
const activeRoots=new WeakSet<ParentNode>();
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

/** One entry point for the public site. HTML/SVG is complete before execution.
 * No pinning, scroll replacement, permanent loop or text splitting is used. */
export function initMotion(root:ParentNode=document):()=>void {
 if(activeRoots.has(root))return ()=>{};
 activeRoots.add(root);
 const disposeSignature=initSignatureMotion(root);
 const disposeEditorial=initEditorialMotion(root);
 let disposed=false;
 return ()=>{
  if(disposed)return;
  disposed=true;
  disposeEditorial();
  disposeSignature();
  activeRoots.delete(root);
 };
}

/** Outside-in coiling deforms each ribbon around a stationary nucleus.
 * All transforms belong to the contours; the wrapper and lettering stay fixed. */
function initSignatureMotion(root:ParentNode):()=>void {
 const shells=Array.from(root.querySelectorAll<SVGSVGElement>('[data-shell-animate]'));
 const cleanups:Array<()=>void>=[];
 for(const shell of shells){
  if(shell.dataset.motionReady==='true')continue;
  shell.dataset.motionReady='true';
  const paths=Array.from(shell.querySelectorAll<SVGPathElement>('[data-ribbon]'));
  const final=paths.map(path=>path.getAttribute('d')??'');
  let played=false;
  let timeline:gsap.core.Timeline|undefined;
  const restore=()=>{
   paths.forEach((path,index)=>{
    path.setAttribute('d',final[index]??'');
    path.removeAttribute('mask');
    path.style.removeProperty('visibility');
    path.style.removeProperty('opacity');
   });
   shell.style.removeProperty('visibility');
   shell.removeAttribute('data-shell-pending');
   shell.dataset.motionProgress='1';
  };
  const media=gsap.matchMedia();
  media.add({normal:'(prefers-reduced-motion: no-preference)',reduced:'(prefers-reduced-motion: reduce)'},context=>{
   if(context.conditions?.reduced||played||!shell.hasAttribute('data-shell-pending')){
    played=true;restore();return restore;
   }
   let observer:IntersectionObserver|undefined;
   try {
    const paintedContours=[...final],paintedOpacity=paths.map(()=> '0');
    const draw=(time:number)=>paths.forEach((path,index)=>{
     const frame=coilState(index,time);
     if(frame.contour!==paintedContours[index]){path.setAttribute('d',frame.contour);paintedContours[index]=frame.contour;}
     const opacity=String(frame.opacity);
     if(opacity!==paintedOpacity[index]){path.style.opacity=opacity;paintedOpacity[index]=opacity;}
    });
    // The mobile hero places this decoration below the first viewport. Keep
    // its source geometry untouched until it is actually about to animate.
    paths.forEach(path=>{path.style.opacity='0';});
    shell.dataset.motionProgress='0';
    shell.removeAttribute('data-shell-pending');
    shell.style.removeProperty('visibility');
    observer=new IntersectionObserver(entries=>{
     if(!entries.some(entry=>entry.isIntersecting)||played)return;
     played=true;observer?.disconnect();
     draw(0);
     timeline=gsap.timeline({onUpdate:()=>{
      shell.dataset.motionProgress=String(timeline?.progress()??0);
     },onComplete:()=>{restore();shell.dataset.motionComplete='true';}});
     const state={time:0};
     timeline.to(state,{time:coilDuration,duration:coilDuration,ease:'none',onUpdate:()=>{
      try{draw(state.time);}catch{timeline?.kill();restore();}
     }},0);
    },{threshold:.15});
    observer.observe(shell);
   } catch {played=true;restore();}
   return ()=>{observer?.disconnect();timeline?.kill();restore();};
  },shell);
  cleanups.push(()=>{media.revert();timeline?.kill();restore();delete shell.dataset.motionReady;});
 }
 return ()=>cleanups.forEach(cleanup=>cleanup());
}
function initEditorialMotion(root:ParentNode):()=>void {
 const media=gsap.matchMedia();
 const revealed=new WeakSet<Element>();
 const drawn=new WeakSet<Element>();
 const scope=root instanceof Element?root:document.documentElement;
 let disposed=false;
 media.add({
  motion:'(prefers-reduced-motion: no-preference)',
  desktop:'(min-width: 900px)',
  precise:'(hover: hover) and (pointer: fine)',
 },context=>{
  if(!context.conditions?.motion)return;
  let active=true;
  const cleanups:Array<()=>void>=[];
  const inContext=(callback:()=>void)=>context.add(callback);

  // One-shot effects need no scroll geometry at startup. The browser batches
  // intersection reads and only visible groups enter the GSAP write phase.
  const watch=(targets:Element[],run:(targets:Element[])=>void,margin:string)=>{
   if(!targets.length)return;
   const observer=new IntersectionObserver(entries=>{
    const entering=entries.filter(entry=>entry.isIntersecting).map(entry=>entry.target);
    if(!entering.length)return;
    entering.forEach(target=>observer.unobserve(target));
    inContext(()=>run(entering));
   },{rootMargin:margin});
   targets.forEach(target=>observer.observe(target));
   cleanups.push(()=>observer.disconnect());
  };

  const readingProgress=root.querySelector<HTMLElement>('.reading-progress');
  if(readingProgress){
   let frame=0,height=0,dirty=true;
   const update=()=>{
    frame=0;
    if(dirty){height=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);dirty=false;}
    readingProgress.style.transform=`scaleX(${clamp(window.scrollY/height,0,1)})`;
   };
   const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
   const onResize=()=>{dirty=true;onScroll();};
   window.addEventListener('scroll',onScroll,{passive:true});
   window.addEventListener('resize',onResize,{passive:true});
   scope.addEventListener('toggle',onResize,true);
   cleanups.push(()=>{
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll',onScroll);
    window.removeEventListener('resize',onResize);
    scope.removeEventListener('toggle',onResize,true);
    readingProgress.style.removeProperty('transform');
   });
  }

  const revealRoots=Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
   .filter(element=>!element.parentElement?.closest('[data-reveal="group"]')&&!revealed.has(element))
   .flatMap(element=>{
    if(element.dataset.reveal==='group'&&!context.conditions?.desktop){
     const children=Array.from(element.children).filter((child):child is HTMLElement=>child instanceof HTMLElement&&!['SCRIPT','STYLE'].includes(child.tagName)&&!revealed.has(child));
     return children.length?children:[element];
    }
    return [element];
   });
  watch(revealRoots,batch=>{
   const timeline=gsap.timeline({defaults:{duration:.6,ease:'power2.out'}});
   batch.forEach((element,index)=>{
    if(revealed.has(element))return;
    revealed.add(element);
    const owner=element as HTMLElement;
    const children=owner.dataset.reveal==='group'
     ?Array.from(owner.children).filter(child=>child instanceof HTMLElement&&!['SCRIPT','STYLE'].includes(child.tagName))
     :[owner];
    const targets=children.length?children:[owner];
    targets.forEach(target=>revealed.add(target));
    timeline.fromTo(targets,{y:owner.dataset.reveal==='fade'?0:24,opacity:.2},{
     y:0,opacity:1,stagger:.08,clearProps:'transform,opacity',
    },Math.min(index,4)*.07);
   });
  },'0px 0px -6% 0px');

  const lineGroups=new Map<Element,SVGGeometryElement[]>();
  root.querySelectorAll<SVGGeometryElement>('[data-line]').forEach(line=>{
   const group=line.closest('[data-link-art]')??line.ownerSVGElement??line;
   if(drawn.has(group)||typeof line.getTotalLength!=='function')return;
   const lines=lineGroups.get(group)??[];
   lines.push(line);lineGroups.set(group,lines);
  });
  watch([...lineGroups.keys()],groups=>{
   // Read every arriving group's lengths before writing any animated styles.
   const measured=groups.map(group=>({group,lines:lineGroups.get(group)??[]}))
    .map(item=>({...item,lengths:item.lines.map(line=>line.getTotalLength())}));
   measured.forEach(({group,lines,lengths})=>{
    if(drawn.has(group))return;
    drawn.add(group);
    const timeline=gsap.timeline({defaults:{ease:'power2.out'}});
    lines.forEach((line,index)=>{
     const delay=Number(line.dataset.lineDelay??index*.08);
     const length=lengths[index]??0;
     timeline.fromTo(line,{strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{
      strokeDashoffset:0,duration:1.25,clearProps:'strokeDasharray,strokeDashoffset',
     },Number.isFinite(delay)?clamp(delay,0,.5):0);
    });
    const nodes=group.querySelectorAll('[data-art-node]');
    if(nodes.length)timeline.fromTo(nodes,{scale:.4,opacity:.2},{scale:1,opacity:1,duration:.55,stagger:.09,clearProps:'transform,opacity,transformOrigin'},.25);
    const halo=group.querySelector('[data-art-halo]');
    if(halo)timeline.fromTo(halo,{scale:.8,opacity:.15},{scale:1,opacity:1,duration:1.1,clearProps:'transform,opacity,transformOrigin'},.25);
   });
  },'0px 0px -10% 0px');

  // Continuous effects retain ScrollTrigger, created just before their section
  // approaches the viewport instead of measuring the entire document at boot.
  watch(Array.from(root.querySelectorAll<HTMLElement>('[data-method]')),targets=>{
   void ensureScrollTrigger().then(ScrollTrigger=>{
    if(!active)return;
    inContext(()=>{
   targets.forEach(target=>{
    const method=target as HTMLElement;
    const steps=Array.from(method.querySelectorAll<HTMLElement>('[data-step]'));
    if(!steps.length)return;
    let horizontal=false,previousActive=-1;
    let stepTops:number[]=[];
    const update=(self:ScrollTriggerInstance)=>{
     const progress=clamp(self.progress,0,1);
     method.style.setProperty('--method-progress',progress.toFixed(4));
     let active=clamp(Math.floor(progress*steps.length),0,steps.length-1);
     if(!horizontal&&stepTops.length){
      const readingLine=self.scroll()+window.innerHeight*.62;
      active=Math.max(0,stepTops.findLastIndex(top=>top<=readingLine));
     }
     steps.forEach((step,index)=>{
      step.style.setProperty('--step-progress',clamp(progress*steps.length-index,0,1).toFixed(4));
      if(active!==previousActive){
       step.dataset.stepActive=String(index===active);
       step.dataset.stepComplete=String(index<active);
      }
     });
     previousActive=active;
    };
    ScrollTrigger.create({
     trigger:method,start:'top 78%',end:'bottom 30%',onUpdate:update,
     onRefresh:self=>{
      const scroll=self.scroll();
      stepTops=steps.map(step=>step.getBoundingClientRect().top+scroll);
      horizontal=Math.abs((stepTops.at(-1)??0)-(stepTops[0]??0))<20;
      update(self);
     },
    });
    let refreshFrame=0;
    const refreshAfterToggle=(event:Event)=>{
     if(!(event.target instanceof HTMLDetailsElement))return;
     cancelAnimationFrame(refreshFrame);
     refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;ScrollTrigger.refresh();});
    };
    method.addEventListener('toggle',refreshAfterToggle,true);
    cleanups.push(()=>{
     cancelAnimationFrame(refreshFrame);
     method.removeEventListener('toggle',refreshAfterToggle,true);
     method.style.removeProperty('--method-progress');
     steps.forEach(step=>{step.style.removeProperty('--step-progress');delete step.dataset.stepActive;delete step.dataset.stepComplete;});
    });
   });
    });
   }).catch(()=>{/* Keep the complete static method if its optional motion fails to load. */});
  },'160px 0px');

  if(context.conditions.desktop&&context.conditions.precise){
   watch(Array.from(root.querySelectorAll<HTMLElement|SVGElement>('[data-parallax]')),targets=>{
    void ensureScrollTrigger().then(()=>{
     if(!active)return;
     inContext(()=>{
    targets.forEach(target=>{
     const element=target as HTMLElement|SVGElement;
     const configured=Number(element.dataset.parallax??12);
     const amplitude=Number.isFinite(configured)?clamp(configured,0,18):12;
     gsap.fromTo(element,{y:amplitude*.5},{y:-amplitude*.5,ease:'none',scrollTrigger:{
      trigger:element.closest('[data-link-art]')??element,start:'top bottom',end:'bottom top',scrub:.6,
     }});
    });
     });
    }).catch(()=>{/* Decorative depth has a complete static fallback. */});
   },'160px 0px');
   watch(Array.from(root.querySelectorAll<HTMLElement>('[data-link-art]')),targets=>{
    targets.forEach(target=>{
     const art=target as HTMLElement;
     const focus=art.querySelector<SVGElement>('[data-art-focus]');
     if(!focus)return;
     const moveX=gsap.quickTo(focus,'x',{duration:.45,ease:'power2.out'});
     const moveY=gsap.quickTo(focus,'y',{duration:.45,ease:'power2.out'});
     let bounds:DOMRect|undefined;
     const enter=()=>{bounds=art.getBoundingClientRect();};
     const move=(event:PointerEvent)=>{
      if(!bounds)return;
      moveX(clamp((event.clientX-bounds.left)/bounds.width-.5,-.5,.5)*4);
      moveY(clamp((event.clientY-bounds.top)/bounds.height-.5,-.5,.5)*4);
     };
     const leave=()=>{bounds=undefined;moveX(0);moveY(0);};
     art.addEventListener('pointerenter',enter);
     art.addEventListener('pointermove',move);
     art.addEventListener('pointerleave',leave);
     cleanups.push(()=>{art.removeEventListener('pointerenter',enter);art.removeEventListener('pointermove',move);art.removeEventListener('pointerleave',leave);});
    });
   },'160px 0px');
  }

  const onFocus=(event:Event)=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   const owner=target.closest('[data-reveal]');
   if(owner){
    revealed.add(owner);
    gsap.getTweensOf([owner,...Array.from(owner.children)]).forEach(tween=>tween.progress(1));
   }
  };
  scope.addEventListener('focusin',onFocus);
  cleanups.push(()=>scope.removeEventListener('focusin',onFocus));
  return ()=>{active=false;cleanups.forEach(cleanup=>cleanup());};
 },scope);
 void document.fonts.ready.then(()=>{if(!disposed&&scrollTriggerModule)scrollTriggerModule.refresh();});
 return ()=>{disposed=true;media.revert();};
}

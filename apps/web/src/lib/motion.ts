import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {ribbonGuides,ribbonFrame} from '../../../../assets/brand/unfurl.mjs';

gsap.registerPlugin(ScrollTrigger);
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

/** Each ribbon grows along its own curved spine. The wrapper never moves. */
function initSignatureMotion(root:ParentNode):()=>void {
 const shells=Array.from(root.querySelectorAll<SVGSVGElement>('[data-shell-animate]'));
 const cleanups:Array<()=>void>=[];
 const svgNS='http://www.w3.org/2000/svg';
 for(const shell of shells){
  if(shell.dataset.motionReady==='true')continue;
  shell.dataset.motionReady='true';
  const paths=Array.from(shell.querySelectorAll<SVGPathElement>('[data-ribbon]'));
  const final=paths.map(path=>path.getAttribute('d')??'');
  let played=false;
  let timeline:gsap.core.Timeline|undefined;
  let masks:SVGDefsElement|undefined;
  const restore=()=>{
   paths.forEach((path,index)=>{
    path.setAttribute('d',final[index]??'');
    path.removeAttribute('mask');
    path.style.removeProperty('visibility');
   });
   masks?.remove();masks=undefined;
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
    masks=document.createElementNS(svgNS,'defs');
    masks.setAttribute('data-unfurl-masks','');
    shell.prepend(masks);
    const idPrefix=`unfurl-${crypto.randomUUID()}`;
    const renderers=ribbonGuides.map(guide=>{
     const path=paths[guide.index];
     if(!path)throw new Error('Missing shell ribbon');
     const mask=document.createElementNS(svgNS,'mask');
     const maskPath=document.createElementNS(svgNS,'path');
     mask.id=`${idPrefix}-${guide.index}`;
     mask.setAttribute('maskUnits','userSpaceOnUse');
     mask.setAttribute('x','-80');mask.setAttribute('y','-80');
     mask.setAttribute('width','760');mask.setAttribute('height','760');
     maskPath.setAttribute('fill','none');maskPath.setAttribute('stroke','white');
     maskPath.setAttribute('stroke-linecap','butt');
     maskPath.setAttribute('stroke-linejoin','round');
     maskPath.setAttribute('pathLength','1');
     maskPath.setAttribute('stroke-dasharray','1 1');
     maskPath.setAttribute('data-ribbon-front',String(guide.index));
     mask.append(maskPath);masks!.append(mask);
     const draw=(progress:number)=>{
      if(progress>=1){
       path.setAttribute('d',final[guide.index]??'');
       path.removeAttribute('mask');
       path.style.removeProperty('visibility');
       return;
      }
      const frame=ribbonFrame(guide.index,progress);
      path.setAttribute('d',frame.contour);
      path.setAttribute('mask',`url(#${mask.id})`);
      path.style.visibility=progress>0?'visible':'hidden';
      maskPath.setAttribute('d',frame.guide);
      maskPath.setAttribute('stroke-width',String(frame.width));
      maskPath.setAttribute('stroke-dashoffset',String(1-progress));
     };
     draw(0);
     return {guide,draw};
    });
    shell.dataset.motionProgress='0';
    shell.removeAttribute('data-shell-pending');
    shell.style.removeProperty('visibility');
    observer=new IntersectionObserver(entries=>{
     if(!entries.some(entry=>entry.isIntersecting)||played)return;
     played=true;observer?.disconnect();
     timeline=gsap.timeline({onUpdate:()=>{
      shell.dataset.motionProgress=String(timeline?.progress()??0);
     },onComplete:()=>{restore();shell.dataset.motionComplete='true';}});
     renderers.forEach(({guide,draw})=>{
      const state={progress:0};
      timeline!.to(state,{progress:1,duration:guide.duration,ease:'none',onUpdate:()=>{
       try{draw(state.progress);}catch{timeline?.kill();restore();}
      }},guide.start);
     });
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
  const cleanups:Array<()=>void>=[];
  const inContext=(callback:()=>void)=>context.add(callback);
  const readingProgress=root.querySelector<HTMLElement>('.reading-progress');
  if(readingProgress)gsap.to(readingProgress,{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:.15}});
  const revealRoots=Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
   .filter(element=>!element.parentElement?.closest('[data-reveal="group"]')&&!revealed.has(element))
   .flatMap(element=>{
    // A stacked group must reveal each row as it enters, rather than consume
    // the whole sequence while its lower rows are still far below the screen.
    if(element.dataset.reveal==='group'&&!context.conditions?.desktop){
     const children=Array.from(element.children).filter((child):child is HTMLElement=>child instanceof HTMLElement&&!['SCRIPT','STYLE'].includes(child.tagName)&&!revealed.has(child));
     return children.length?children:[element];
    }
    return [element];
   });

  // A group appears as a small sequence; independent siblings entering during
  // the same frame are batched. Nothing is hidden while waiting for a trigger.
  ScrollTrigger.batch(revealRoots,{
   start:'top 94%',once:true,interval:.06,batchMax:5,
   onEnter:batch=>inContext(()=>{
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
     },index*.07);
    });
   }),
  });

  // Draw paths in coherent groups. The faint printed tracks in LinkArt stay
  // visible throughout. Native getTotalLength avoids an SVG plugin payload.
  const lineGroups=new Map<Element,SVGGeometryElement[]>();
  root.querySelectorAll<SVGGeometryElement>('[data-line]').forEach(line=>{
   const group=line.closest('[data-link-art]')??line.ownerSVGElement??line;
   if(drawn.has(group)||typeof line.getTotalLength!=='function')return;
   const lines=lineGroups.get(group)??[];
   lines.push(line);
   lineGroups.set(group,lines);
  });
  lineGroups.forEach((lines,group)=>{
   const lengths=lines.map(line=>line.getTotalLength());
   ScrollTrigger.create({trigger:group,start:'top 90%',once:true,onEnter:()=>inContext(()=>{
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
   })});
  });

  root.querySelectorAll<HTMLElement>('[data-method]').forEach(method=>{
   const steps=Array.from(method.querySelectorAll<HTMLElement>('[data-step]'));
   if(!steps.length)return;
   let horizontal=false;
   let stepTops:number[]=[];
   let previousActive=-1;
   const update=(self:ScrollTrigger)=>{
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

  // A restrained depth cue on large screens, driven only by deliberate scroll.
  // Mobile/coarse pointers get the complete, stationary composition instead.
  if(context.conditions.desktop&&context.conditions.precise){
   root.querySelectorAll<HTMLElement|SVGElement>('[data-parallax]').forEach(element=>{
    const configured=Number(element.dataset.parallax??12);
    const amplitude=Number.isFinite(configured)?clamp(configured,0,18):12;
    gsap.fromTo(element,{y:amplitude*.5},{y:-amplitude*.5,ease:'none',scrollTrigger:{
     trigger:element.closest('[data-link-art]')??element,start:'top bottom',end:'bottom top',scrub:.6,
    }});
   });
   root.querySelectorAll<HTMLElement>('[data-link-art]').forEach(art=>{
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
  }

  // Finish a reveal immediately if keyboard navigation reaches its content.
  const onFocus=(event:Event)=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   const owner=target.closest('[data-reveal]');
   if(owner)gsap.getTweensOf([owner,...Array.from(owner.children)]).forEach(tween=>tween.progress(1));
  };
  scope.addEventListener('focusin',onFocus);
  cleanups.push(()=>scope.removeEventListener('focusin',onFocus));
  return ()=>cleanups.forEach(cleanup=>cleanup());
 },scope);
 void document.fonts.ready.then(()=>{if(!disposed)ScrollTrigger.refresh();});
 return ()=>{disposed=true;media.revert();};
}

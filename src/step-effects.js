// Pointer-led reading cues. The text never moves and each step stays selectable.
const stepFinePointer=matchMedia('(hover: hover) and (pointer: fine)');
const stepReducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const stepProperties=['x','y','dx','dy','scale','aura'];
let stepActive=null,stepPoint=null,stepFrame=0;
function clearStepHighlight(){
  if(stepActive){
    stepActive.classList.remove('step-hover');
    for(const key of stepProperties)stepActive.style.removeProperty('--step-'+key);
  }
  stepActive=null;
}
function resetStepEffects(){
  cancelAnimationFrame(stepFrame);stepFrame=0;stepPoint=null;clearStepHighlight();
}
function paintStepHighlight(){
  stepFrame=0;
  if(!stepPoint||!stepFinePointer.matches||document.hidden)return;
  const hit=document.elementFromPoint(stepPoint.x,stepPoint.y);
  const step=hit?.closest('.interactive-steps > li')||null;
  if(step!==stepActive){clearStepHighlight();stepActive=step;step?.classList.add('step-hover');}
  if(!step||stepReducedMotion.matches)return;
  const bounds=step.getBoundingClientRect(),badge=step.querySelector('.step-index').getBoundingClientRect();
  const x=stepPoint.x-bounds.left,y=stepPoint.y-bounds.top;
  const near=Math.max(0,1-Math.hypot(stepPoint.x-badge.left-badge.width/2,stepPoint.y-badge.top-badge.height/2)/260);
  const clamp=value=>Math.max(-1,Math.min(1,value));
  const values={x:x+'px',y:y+'px',dx:(clamp(x/bounds.width*2-1)*1.5)+'px',dy:(clamp(y/bounds.height*2-1)*1.2)+'px',scale:1.035+near*.045,aura:(12+near*14)+'px'};
  for(const [key,value] of Object.entries(values))step.style.setProperty('--step-'+key,String(value));
}
function scheduleStepHighlight(){if(stepPoint&&!stepFrame)stepFrame=requestAnimationFrame(paintStepHighlight);}
document.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch'||!stepFinePointer.matches)return;
  stepPoint={x:event.clientX,y:event.clientY};scheduleStepHighlight();
},{passive:true});
document.addEventListener('pointerout',event=>{
  if(!event.relatedTarget)resetStepEffects();
  else if(stepActive?.contains(event.target)&&!stepActive.contains(event.relatedTarget))clearStepHighlight();
},{passive:true});
// A stationary pointer should highlight the new step beneath it after scrolling.
window.addEventListener('scroll',scheduleStepHighlight,{passive:true,capture:true});
window.addEventListener('resize',scheduleStepHighlight,{passive:true});
document.addEventListener('pointercancel',resetStepEffects,{passive:true});
window.addEventListener('blur',resetStepEffects);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetStepEffects();});
stepFinePointer.addEventListener('change',resetStepEffects);
stepReducedMotion.addEventListener('change',resetStepEffects);

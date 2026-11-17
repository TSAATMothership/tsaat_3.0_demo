// These effects are decorative: artwork stays out of the tab order and gestures
// retain their normal scrolling, selection and navigation behavior.
const artworkReducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const artworkFinePointer=matchMedia('(hover: hover) and (pointer: fine)');
let artworkActive=null,artworkFrame=0,artworkPoint=null,artworkPulse=null,artworkPulseTimer=0;
function artworkHost(target){
  const host=target instanceof Element?target.closest('.hero,.topic-banner'):null;
  return host?.querySelector('.plot img,.terrain-art,.topic-art')?host:null;
}
function resetArtworkHover(){
  cancelAnimationFrame(artworkFrame);artworkFrame=0;artworkPoint=null;
  if(artworkActive){
    artworkActive.classList.remove('art-engaged');
    for(const key of ['x','y','rx','ry'])artworkActive.style.removeProperty('--art-'+key);
  }
  artworkActive=null;
}
function resetArtworkEffects(){
  resetArtworkHover();clearTimeout(artworkPulseTimer);
  artworkPulse?.classList.remove('art-pulse');artworkPulse=null;
}
document.addEventListener('pointermove',event=>{
  if(artworkReducedMotion.matches||!artworkFinePointer.matches||event.pointerType==='touch')return;
  const host=artworkHost(event.target);
  if(host!==artworkActive){resetArtworkHover();artworkActive=host;}
  if(!host)return;
  artworkPoint={x:event.clientX,y:event.clientY};
  if(artworkFrame)return;
  artworkFrame=requestAnimationFrame(()=>{
    artworkFrame=0;if(!artworkActive?.isConnected||!artworkPoint)return;
    const bounds=artworkActive.getBoundingClientRect();
    const clamp=value=>Math.max(-1,Math.min(1,value));
    const x=clamp((artworkPoint.x-bounds.left)/bounds.width*2-1),y=clamp((artworkPoint.y-bounds.top)/bounds.height*2-1);
    for(const [key,value] of Object.entries({x:(x*5)+'px',y:(y*3)+'px',rx:(-y*2)+'deg',ry:(x*3)+'deg'}))artworkActive.style.setProperty('--art-'+key,value);
    artworkActive.classList.add('art-engaged');
  });
},{passive:true});
document.addEventListener('pointerout',event=>{
  if(artworkActive&&artworkActive.contains(event.target)&&!artworkActive.contains(event.relatedTarget))resetArtworkHover();
},{passive:true});
document.addEventListener('pointerdown',event=>{
  if(artworkReducedMotion.matches||event.button!==0||event.target.closest('a,button,input,textarea,select,label'))return;
  const host=artworkHost(event.target);if(!host)return;
  clearTimeout(artworkPulseTimer);artworkPulse?.classList.remove('art-pulse');
  artworkPulse=host;host.classList.add('art-pulse');
  artworkPulseTimer=setTimeout(()=>{artworkPulse?.classList.remove('art-pulse');artworkPulse=null;},650);
},{passive:true});
document.addEventListener('pointercancel',resetArtworkEffects,{passive:true});
window.addEventListener('blur',resetArtworkEffects);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetArtworkEffects();});
artworkReducedMotion.addEventListener('change',resetArtworkEffects);
artworkFinePointer.addEventListener('change',resetArtworkEffects);

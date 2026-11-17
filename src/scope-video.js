// Videos live beside the HTML; posters and captions stay in saved HTML copies.
let disposeScopeVideo = () => {};
function scopeVideoPanel(id) {
  const recording=media.walkthroughs?.[id];
  if(!recording)return '';
  const scopeVideoChapters=recording.chapters,count=scopeVideoChapters.length;
  const duration=recording.duration<60?`${recording.duration} sec`:`${Math.floor(recording.duration/60)} min ${recording.duration%60} sec`;
  return `<section class="scope-video" data-video-topic="${id}" aria-labelledby="scope-video-heading">
    <header class="scope-video-heading"><div><p class="eyebrow"><span></span>Watch the walkthrough</p><h2 id="scope-video-heading">${tx('t.'+id+'.title')}</h2><p>Follow the ${count} steps in the actual practice lab, using its sample data.</p></div><span class="scope-video-duration">${duration} · Text-guided</span></header>
    <video id="scope-video-player" controls playsinline preload="none" poster="${recording.poster}" aria-label="${tx('t.'+id+'.title')}: ${count}-step video walkthrough" aria-describedby="scope-video-help"><p>Your browser cannot play this video. Follow the step-by-step guide below.</p></video>
    <p id="scope-video-help" class="scope-video-help">No audio needed. Use the player controls or jump to a step. On a small screen, use fullscreen for a closer look.</p>
    <nav class="scope-video-chapters" style="--chapter-count:${count}" aria-label="Video steps">${scopeVideoChapters.map((time,i)=>`<button type="button" data-video-step="${i}" aria-controls="scope-video-player" aria-label="Jump to step ${i+1}: ${tx('t.'+id+'.s'+(i+1))}"><span>${pad(i+1)}</span><span>${tx('t.'+id+'.s'+(i+1))}<small>${Math.floor(time/60)}:${pad(time%60)}</small></span></button>`).join('')}</nav>
    <p class="scope-video-error" role="status" hidden>The video could not be played. Keep ${safe(recording.video)} in the same folder as this guide. You can also follow all ${count} steps in the transcript or guide below.</p>
    <details class="scope-video-transcript"><summary>Read the walkthrough transcript</summary><ol>${scopeVideoChapters.map((_,i)=>`<li><h3>${tx('t.'+id+'.s'+(i+1))}</h3><p>${tx('t.'+id+'.b'+(i+1))}</p></li>`).join('')}</ol></details>
  </section>`;
}
function setupScopeVideo() {
  const video=byId('scope-video-player');
  if(!video)return;
  const panel=video.closest('.scope-video'),buttons=[...panel.querySelectorAll('[data-video-step]')];
  const recording=media.walkthroughs[panel.dataset.videoTopic],scopeVideoChapters=recording.chapters;
  const urls=[];
  const asset=(data,type)=>{const url=URL.createObjectURL(new Blob([base64ToBytes(data.split(',')[1])],{type}));urls.push(url);return url;};
  video.src=recording.video;
  const track=document.createElement('track');
  track.kind='captions';track.label='English';track.srclang='en';track.src=asset(recording.captions,'text/vtt');video.append(track);
  const update=()=>{const active=scopeVideoChapters.findLastIndex(time=>video.currentTime>=time);buttons.forEach((button,i)=>{if(i===active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});};
  let pendingTime=null;
  const seek=()=>{if(pendingTime===null)return;video.currentTime=pendingTime;pendingTime=null;update();};
  const click=event=>{const button=event.target.closest('[data-video-step]');if(!button)return;pendingTime=scopeVideoChapters[Number(button.dataset.videoStep)];if(video.readyState>=1)seek();else video.load();};
  const error=()=>{panel.querySelector('.scope-video-error').hidden=false;};
  panel.addEventListener('click',click);video.addEventListener('timeupdate',update);video.addEventListener('loadedmetadata',seek);video.addEventListener('error',error);update();
  disposeScopeVideo=()=>{video.pause();panel.removeEventListener('click',click);video.removeEventListener('timeupdate',update);video.removeEventListener('loadedmetadata',seek);video.removeEventListener('error',error);video.removeAttribute('src');track.remove();video.load();urls.forEach(url=>URL.revokeObjectURL(url));disposeScopeVideo=()=>{};};
}

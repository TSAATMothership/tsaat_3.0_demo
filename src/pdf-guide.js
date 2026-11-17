// Browser-only handbook: selectable text, vector diagrams and embedded local artwork.
// Page layout uses top-down coordinates; text always wraps before pagination.
let pdfGuideBusy=false,pdfGuideStatus='';
async function createGuidePdf(get, report=()=>{}){
  const P=window.PDFLib;
  if(!P)throw Error('The bundled PDF tools are unavailable. Reopen the guide and try again.');
  const doc=await P.PDFDocument.create();
  const regular=await doc.embedFont(P.StandardFonts.Helvetica);
  const bold=await doc.embedFont(P.StandardFonts.HelveticaBold);
  const oblique=await doc.embedFont(P.StandardFonts.HelveticaOblique);
  const content=handbookContent(get,model);
  doc.setTitle(content.title);doc.setAuthor('TSAAT');doc.setSubject('A visual guide to exploring cyber terrain with TSAAT');
  doc.setCreator('TSAAT offline user guide');doc.setProducer('TSAAT browser handbook / PDF-lib');
  doc.setLanguage('en-AU');
  const W=595.28,H=841.89,M=42,CW=W-M*2,BOTTOM=778;
  const color=hex=>P.rgb(parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255);
  const ink=color('122D3D'),muted=color('4B6471'),teal=color('087F80'),mint=color('84DDCF'),amber=color('E3A13C'),paper=color('F7F9F8'),white=P.rgb(1,1,1),line=color('D9E4E5'),pale=color('E9F4F1'),warm=color('FFF2DB'),navy=color('0D2232');
  const pages=[],destinations=new Map(),links=[],index=[];
  function clean(value){
    const normalized=String(value??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\u2192/g,' > ').replace(/\u2190/g,' < ').replace(/\u2193/g,' v ').replace(/\u2026/g,'...').replace(/\u00a0/g,' ').replace(/\u2264/g,' <= ').replace(/\u2265/g,' >= ').replace(/\u2260/g,' != ').replace(/[\u2022\u2713\u2714]/g,'-');
    for(const char of normalized){if(/[\n\r\t]/.test(char))continue;try{regular.encodeText(char);}catch{throw Error('The workbook contains a character the PDF font cannot display ('+char+'). Spell it out in the workbook, then try again.');}}
    return normalized;
  }
  function wrapped(value,width,size=10.5,font=regular){
    const result=[];
    for(const paragraph of clean(value).split(/\n/)){
      let current='';
      for(let word of paragraph.trim().split(/\s+/).filter(Boolean)){
        if(font.widthOfTextAtSize(word,size)>width){
          if(current){result.push(current);current='';}
          let part='';for(const char of word){if(font.widthOfTextAtSize(part+char,size)>width){result.push(part);part='';}part+=char;}current=part;
        }else if(current&&font.widthOfTextAtSize(current+' '+word,size)>width){result.push(current);current=word;}
        else current+=(current?' ':'')+word;
      }
      result.push(current);
    }
    return result;
  }
  function textHeight(value,width,size=10.5,font=regular,leading=size*1.38){return wrapped(value,width,size,font).length*leading;}
  function lines(page,items,x,top,size=10.5,font=regular,fill=ink,leading=size*1.38){
    for(const row of items){if(row)page.drawText(row,{x,y:H-top-size,font,size,color:fill});top+=leading;}return top;
  }
  function text(page,value,x,top,width,size=10.5,font=regular,fill=ink,leading=size*1.38){return lines(page,wrapped(value,width,size,font),x,top,size,font,fill,leading);}
  function rect(page,x,y,width,height,fill,border){page.drawRectangle({x,y:H-y-height,width,height,color:fill,...(border?{borderColor:border,borderWidth:.7}:{})});}
  function rule(page,x,y,width,fill=line,weight=.7){page.drawLine({start:{x,y:H-y},end:{x:x+width,y:H-y},color:fill,thickness:weight});}
  function segment(page,x1,y1,x2,y2,fill=teal,weight=1.3){page.drawLine({start:{x:x1,y:H-y1},end:{x:x2,y:H-y2},color:fill,thickness:weight});}
  function circle(page,x,y,r,fill){page.drawCircle({x,y:H-y,size:r,color:fill});}
  function tag(page,label,x,y,fill=teal){text(page,clean(label).toUpperCase(),x,y,CW,8.4,bold,fill,11);}
  function bookmark(key,page,top=42){destinations.set(key,{page,top});}
  function clickable(page,x,top,width,height,key){links.push({page,x,top,width,height,key});}
  function addPage(section,dark=false){
    const page=doc.addPage([W,H]);pages.push({page,section,dark});rect(page,0,0,W,H,dark?navy:paper);
    if(!dark){rect(page,0,0,7,H,teal);tag(page,'TSAAT / '+section,M,22,muted);rule(page,M,38,CW);}
    return page;
  }
  function pageHeading(page,kicker,title,intro='',size=29){
    tag(page,kicker,M,58);let y=text(page,title,M,80,CW,size,bold,ink,size*1.12)+12;
    if(intro)y=text(page,intro,M,y,CW,11.2,regular,muted,15.5)+20;
    return y;
  }
  function continuePage(section,title){const page=addPage(section);const top=pageHeading(page,'Continued',title,'',22)+10;return {page,y:top};}
  function flowing(section,title,blocks,start){
    let {page,y}=start;
    for(const [bi,b] of blocks.entries()){
      const x=b.x??M,width=b.width??CW,size=b.size??10.5,font=b.font??regular,leading=b.leading??size*1.4;
      const rows=wrapped(b.text,width,size,font);let offset=0;
      const next=blocks[bi+1],follow=b.font===bold&&next?Math.min(2,wrapped(next.text,next.width??CW,next.size??10.5,next.font??regular).length)*(next.leading??(next.size??10.5)*1.4)+(b.gap??12):0;
      if(b.keep&&y+rows.length*leading+follow>BOTTOM&&rows.length*leading+follow<BOTTOM-150){({page,y}=continuePage(section,title));}
      while(offset<rows.length){
        let capacity=Math.floor((BOTTOM-y)/leading);
        if(capacity<1){({page,y}=continuePage(section,title));capacity=Math.floor((BOTTOM-y)/leading);}
        const take=Math.min(rows.length-offset,capacity);lines(page,rows.slice(offset,offset+take),x,y,size,font,b.fill??ink,leading);y+=take*leading;offset+=take;
        if(offset<rows.length)({page,y}=continuePage(section,title));
      }
      y+=b.gap??12;
    }
    return {page,y};
  }
  async function artwork(id){
    const data=media[id];if(!data)throw Error('Missing guide artwork: '+id);
    if(data.startsWith('data:image/png'))return doc.embedPng(data);
    const image=new Image();image.src=data;
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('The '+id+' illustration could not be loaded.'));});
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth*3;canvas.height=image.naturalHeight*3;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Your browser could not draw the PDF illustrations.');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);return doc.embedPng(canvas.toDataURL('image/png'));
  }
  const art={};for(const id of ['logo','terrain','endpoint','software','vulnerability']){report('Preparing illustrations...');art[id]=await artwork(id);}
  function picture(page,id,x,top,width,height){const image=art[id],scale=Math.min(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;page.drawImage(image,{x:x+(width-w)/2,y:H-top-(height+h)/2,width:w,height:h});}
  function cardHeight(title,body,width){return 42+textHeight(title,width-28,11,bold,14)+textHeight(body,width-28,10,regular,14);}
  function card(page,title,body,x,y,width,fill=pale){
    const h=cardHeight(title,body,width);
    rect(page,x,y,width,h,fill);rect(page,x,y,3,h,fill===warm?amber:teal);
    const end=text(page,title,x+14,y+14,width-28,11,bold,ink,14)+8;
    text(page,body,x+14,end,width-28,10,regular,muted,14);return y+h;
  }
  function infographic(page,type,x,y,width){
    rect(page,x,y,width,142,navy);
    const pad=13,w=width-pad*2;
    tag(page,type==='network'?'Illustrative links':'At a glance',x+pad,y+11,mint);
    if(type==='network'){
      const nodes=[['Service',y+38],['System',y+72],['Endpoint',y+106]];
      for(let i=0;i<nodes.length;i++){
        const [label,top]=nodes[i];if(i)segment(page,x+width/2,top-11,x+width/2,top,mint);
        rect(page,x+pad,top,w,23,i===1?teal:color('1E3D50'));text(page,label,x+pad+10,top+5,w-20,9,bold,white,11);
      }
    }else if(type==='scope'){
      [['Network / system',w],['Security domain',w-18],['Snapshot',w-36]].forEach(([label,bw],i)=>{const left=x+(width-bw)/2,top=y+35+i*29;rect(page,left,top,bw,24,i===2?teal:color('1E3D50'));text(page,label,left+8,top+6,bw-16,8.7,bold,white,11);});
    }else if(type==='risk'){
      ['Records','Different CVEs','Affected endpoints'].forEach((label,i)=>{circle(page,x+22,y+45+i*31,6,i===0?mint:i===1?amber:white);text(page,label,x+36,y+39+i*31,width-48,9,bold,white,12);});
    }else{
      const labels=type==='coverage'?['Required checks','Evidence present','Gaps to follow up']:type==='records'?['Find the row','Read its source','Check its date']:['Choose a view','Check the evidence','Share a next step'];
      labels.forEach((label,i)=>{circle(page,x+23,y+46+i*31,9,i===2?amber:mint);text(page,String(i+1),x+20,y+40+i*31,15,9,bold,navy,11);text(page,label,x+39,y+40+i*31,width-51,8.5,bold,white,11);});
    }
  }
  // Cover: ample negative space, one familiar illustration and a clear promise.
  const cover=addPage('Start here',true);bookmark('cover',cover);
  picture(cover,'logo',M,45,45,45);text(cover,'TSAAT User Guide',M+60,57,CW-60,8.4,bold,mint,11);
  let cy=text(cover,content.title,M,131,CW,46,bold,white,49)+20;
  cy=text(cover,content.subtitle,M,cy,CW-50,20,regular,mint,26)+18;
  text(cover,content.intro,M,cy,CW-20,12,regular,color('C3D9E0'),18);
  picture(cover,'terrain',M-10,350,CW+20,288);
  rule(cover,M,656,CW,color('31515F'));
  tag(cover,'FROM A QUESTION TO A CLEAR NEXT STEP',M,677,mint);
  text(cover,content.tagline,M,700,CW,13,bold,white,18);
  text(cover,'A practical handbook for your cyber terrain.\nGenerated from the text currently loaded in your guide.',M,753,CW,9.2,regular,color('C3D9E0'),13);
  const contentsPage=addPage('Your route');bookmark('contents',contentsPage);
  // The evidence infographic is generated from the guide's editable worked examples.
  const numbers=addPage('Read the evidence');bookmark('numbers',numbers);index.push({key:'numbers',title:'Read the same evidence three ways'});
  let ny=pageHeading(numbers,'THE BIG IDEA','Count the right thing','A row, a product and a device are different things. These made-up examples show why the labels matter.');
  for(const id of model.examples){
    const prefix='ex.'+id+'.';const title=get(prefix+'title'),desc=get(prefix+'desc').replace(/Select a measure[^.]*\.?/gi,'');
    ny=text(numbers,title,M,ny,CW,16,bold,ink,20)+6;ny=text(numbers,desc,M,ny,CW,10,regular,muted,14)+12;
    const cw=(CW-20)/3,counts=[0,1,2].map(i=>({value:get(prefix+'n'+i),label:get(prefix+'a'+i)}));
    const bh=Math.max(...counts.map(c=>textHeight(c.label,cw-22,9,bold,12)))+60;
    counts.forEach((c,i)=>{const x=M+i*(cw+10);rect(numbers,x,ny,cw,bh,i===2?navy:pale);text(numbers,c.value,x+11,ny+10,cw-22,28,bold,i===2?mint:teal,32);text(numbers,c.label,x+11,ny+49,cw-22,9,bold,i===2?white:ink,12);});
    ny+=bh+22;
  }
  if(ny+48<BOTTOM)card(numbers,'A useful habit','Before quoting a total, say what is being counted, what was selected and which snapshot was used.',M,ny,CW,warm);
  const topicOrder=content.topicOrder||['scope','navigate','tables','govern-end','explore-end','cmdb','shadow','govern-soft','explore-soft','govern-vuln','explore-vuln','topology','exports'];
  for(let ti=0;ti<topicOrder.length;ti++){
    const id=topicOrder[ti],topic=model.topics[id],pre='t.'+id+'.',extra=content.topicExtras[id]||{};
    report('Building walkthrough '+(ti+1)+' of '+topicOrder.length+'...');
    const title=get(pre+'title'),section=get('ui.'+topic.group),page=addPage(section);bookmark('topic-'+id,page);index.push({key:'topic-'+id,title});
    tag(page,section+' / '+String(ti+1).padStart(2,'0'),M,57);
    let y=text(page,title,M,78,CW-146,27,bold,ink,30)+10;
    y=text(page,get(pre+'short'),M,y,CW-146,10.5,regular,muted,14.5)+9;
    y=text(page,get(pre+'route'),M,y,CW-146,8.4,bold,teal,12)+18;
    rect(page,W-M-130,63,130,112,navy);picture(page,topic.art,W-M-128,67,126,104);
    const startY=Math.max(195,y),mainW=310,gap=22,sideX=M+mainW+gap,sideW=CW-mainW-gap;
    let main={page,y:startY},side={page,y:startY};
    const stepBlocks=[],laterSteps=[];
    for(let i=1;i<=topic.n;i++){
      const target=id==='topology'&&i>=4?laterSteps:stepBlocks;
      target.push({text:String(i).padStart(2,'0')+'  '+get(pre+'s'+i),font:bold,size:11.2,leading:14.5,fill:teal,width:mainW,gap:5,keep:true});
      target.push({text:get(pre+'b'+i),size:10.5,leading:14.6,width:mainW,gap:17});
    }
    main=flowing(section,title,stepBlocks,main);
    const sideBlocks=[
      {text:extra.question||'What should I look for?',font:bold,size:12,fill:ink,gap:15},
      {text:'READ IT THIS WAY',font:bold,size:8.5,fill:teal,gap:6},
      {text:get(pre+'interpret'),size:9.7,leading:13.8,gap:16},
      {text:'LEAVE WITH',font:bold,size:8.5,fill:teal,gap:6},
      {text:get(pre+'output'),size:9.7,leading:13.8,gap:16}
    ];
    if(extra.tip)sideBlocks.push({text:'GOOD TO KNOW',font:bold,size:8.5,fill:teal,gap:6},{text:extra.tip,size:9.7,leading:13.8,gap:18});
    side=flowing(section,title+' / Notes',sideBlocks.map(b=>({...b,x:sideX,width:sideW,keep:true})),side);
    if(side.y+153<BOTTOM&&id!=='topology'){infographic(side.page,id==='shadow'?'records':extra.diagram||'flow',sideX,side.y,sideW);side.y+=153;}
    const wordTop=Math.max(main.page===page?main.y:0,side.page===page?side.y:0)+8;
    if(main.page===page&&side.page===page&&wordTop+45<BOTTOM){
      rule(page,M,wordTop,CW);text(page,'Word help',M,wordTop+12,65,9,bold,teal);text(page,'New term? Jump to the glossary.',M+69,wordTop+12,CW-69,9,regular,muted);clickable(page,M,wordTop+9,CW,23,'glossary');
    }
    if(laterSteps.length){
      const spread=addPage(section);let sy=pageHeading(spread,'TOPOLOGY / FOLLOW AND CAPTURE',title,'Read the links, inspect the detail, then capture a path someone else can check.',25);
      flowing(section,title,laterSteps,{page:spread,y:sy});
      infographic(spread,'network',sideX,sy,sideW);
      flowing(section,title+' / Notes',[
        {text:'A recorded path',font:bold,size:11,fill:teal,gap:7},
        {text:'This sketch shows possible recorded links. Always read the actual relationship type and environment in TSAAT. The graph mode decides which items and links are included.',size:10,leading:14,gap:18},
        {text:'KEEP THE CONTEXT',font:bold,size:8.5,fill:teal,gap:7},
        {text:extra.tryIt,size:10,leading:14}
      ].map(b=>({...b,x:sideX,width:sideW})),{page:spread,y:sy+160});
    }
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  // Role pathways use the same questions, steps and handoffs as the live guide.
  for(const [ri,id] of Object.keys(model.roles).entries()){
    const pre='r.'+id+'.',title=get(pre+'title'),page=addPage('Guides by role');
    if(ri===0){bookmark('roles',page);index.push({key:'roles',title:'Find your role pathway'});}
    let y=pageHeading(page,'YOUR ROLE / '+String(ri+1).padStart(2,'0'),title,get(pre+'short'));
    const question=get(pre+'question');let rolePage=page;
    if(y+cardHeight('Start with a question',question,CW)<BOTTOM)y=card(page,'Start with a question',question,M,y,CW,warm)+22;
    else {const state=flowing('Guides by role',title,[{text:'Start with a question',font:bold,size:12,keep:true},{text:question,size:11,leading:15}],{page,y});y=state.y;rolePage=state.page;}
    const blocks=[];
    for(let i=1;i<=4;i++)blocks.push({text:String(i).padStart(2,'0')+'  '+get(pre+'s'+i),font:bold,size:13,fill:teal,gap:6,keep:true},{text:get(pre+'b'+i),size:11,leading:15.5,gap:18});
    blocks.push({text:'YOUR HANDOFF',font:bold,size:9,fill:teal,gap:6,keep:true},{text:get(pre+'out'),size:11,leading:15.5,gap:16});
    const end=flowing('Guides by role',title,blocks,{page:rolePage,y});
    const personaTip="A role pathway suggests a useful order of tasks. The app's Persona setting controls which pages and actions you can see.";
    if(end.y+cardHeight('Role guide or Persona?',personaTip,CW)<BOTTOM)card(end.page,'Role guide or Persona?',personaTip,M,end.y,CW,pale);
  }
  const practice=addPage('Practice lab');bookmark('practice',practice);index.push({key:'practice',title:'Get comfortable in the practice lab'});
  let py=pageHeading(practice,'LEARN BY EXPLORING',content.practice.title,content.practice.intro);
  const practiceBlocks=[{text:get('lab.instructions').replace(/\bthis guide\b/gi,'the interactive HTML guide'),size:11,leading:15.5,gap:22}];
  for(const [i,step] of content.practice.steps.entries())practiceBlocks.push({text:String(i+1).padStart(2,'0')+'  '+step.title,font:bold,size:12,fill:teal,gap:6,keep:true},{text:step.body,size:10.5,leading:14.5,gap:17});
  for(const note of content.practice.notes)practiceBlocks.push({text:note.title,font:bold,size:11,fill:teal,gap:5,keep:true},{text:note.body,size:10.5,leading:14.5,gap:16});
  flowing('Practice lab',content.practice.title,practiceBlocks,{page:practice,y:py});
  const fixes=[...model.fix.map(id=>({title:get('fix.'+id+'.title'),body:get('fix.'+id+'.body')})),...content.troubleExtras];
  let fp=addPage('Troubleshooting');bookmark('trouble',fp);index.push({key:'trouble',title:'When something does not look right'});
  let fy=pageHeading(fp,'GET UNSTUCK','When something does not look right','Start with the selection and the snapshot. A missing record, a zero count and a loading error mean different things.');
  for(const [i,fix] of fixes.entries()){
    const need=textHeight(fix.title,CW-58,12,bold,16)+textHeight(fix.body,CW-58,10.5,regular,15)+36;
    if(fy+need>BOTTOM){fp=addPage('Troubleshooting');fy=pageHeading(fp,'GET UNSTUCK / CONTINUED','A few more quick fixes','',24);}
    if(need>BOTTOM-fy){const end=flowing('Troubleshooting',fix.title,[{text:fix.title,font:bold,size:13,fill:teal,keep:true},{text:fix.body,size:10.5,leading:15}],{page:fp,y:fy});fp=end.page;fy=end.y;continue;}
    circle(fp,M+12,fy+10,11,teal);text(fp,String(i+1),M+7,fy+4,20,9,bold,white,12);
    let bottom=text(fp,fix.title,M+34,fy,CW-34,12,bold,ink,16)+7;
    bottom=text(fp,fix.body,M+34,bottom,CW-34,10.5,regular,muted,15);fy=bottom+18;rule(fp,M+34,fy,CW-34);fy+=20;
  }
  let keyboard=addPage('Handy controls');bookmark('keyboard',keyboard);index.push({key:'keyboard',title:'Handy controls and a clear handoff'});
  let ky=pageHeading(keyboard,'SMALL HABITS / BETTER RESULTS','Keep the work moving','Use the keyboard when it helps, and leave the next person enough information to check your work.');
  for(const id of model.keys){
    const title=get('keys.'+id+'.title'),body=get('keys.'+id+'.body');
    const need=42+textHeight(title,CW-28,11,bold,14)+textHeight(body,CW-28,10,regular,14);
    if(ky+need>BOTTOM){const next=continuePage('Handy controls','Handy controls');keyboard=next.page;ky=next.y;}
    if(ky+need>BOTTOM){const end=flowing('Handy controls','Handy controls',[{text:title,font:bold,size:11,fill:teal,keep:true},{text:body,size:10,leading:14}],{page:keyboard,y:ky});keyboard=end.page;ky=end.y;}
    else ky=card(keyboard,title,body,M,ky,CW,pale)+14;
  }
  if(ky+130<BOTTOM){ky+=8;ky=text(keyboard,content.closing.title,M,ky,CW,20,bold,ink,25)+12;text(keyboard,content.closing.body,M,ky,CW,11,regular,muted,16);}
  else flowing('Handy controls',content.closing.title,[{text:content.closing.title,size:20,font:bold,keep:true},{text:content.closing.body,size:11}],continuePage('Handy controls',content.closing.title));
  // Alphabetical glossary with real internal PDF destinations.
  const terms=[...model.gloss].sort((a,b)=>get('gloss.'+a+'.title').localeCompare(get('gloss.'+b+'.title'),'en'));
  let gp=addPage('Glossary');bookmark('glossary',gp);index.push({key:'glossary',title:'Glossary: words made simple'});
  let gy=pageHeading(gp,'WORD HELP','Words made simple','Keep this section close. These are the same definitions you can open from underlined terms in the HTML guide.');
  for(const id of terms){
    const title=get('gloss.'+id+'.title'),body=get('gloss.'+id+'.body');
    const need=textHeight(title,CW,12,bold,16)+textHeight(body,CW,10.5,regular,15)+22;
    if(gy+need>BOTTOM){gp=addPage('Glossary');gy=pageHeading(gp,'WORD HELP / CONTINUED','Glossary','',24);}
    bookmark('gloss-'+id,gp,gy);
    const end=flowing('Glossary','Glossary',[{text:title,size:12,font:bold,fill:teal,leading:16,gap:6,keep:true},{text:body,size:10.5,leading:15,gap:9}],{page:gp,y:gy});gp=end.page;gy=end.y;rule(gp,M,gy,CW);gy+=8;
  }
  // Fill the contents once the actual page destinations are known.
  let iy=pageHeading(contentsPage,'START HERE',content.roadmap.title,content.roadmap.intro);
  const rw=(CW-30)/4;
  const roadmapHeight=Math.max(...content.roadmap.steps.map(s=>textHeight(s.title,rw-18,11,bold,14)+textHeight(s.body,rw-18,9,regular,12)))+57;
  for(const [i,step] of content.roadmap.steps.entries()){
    const x=M+i*(rw+10);rect(contentsPage,x,iy,rw,roadmapHeight,i%2?pale:white,line);circle(contentsPage,x+18,iy+22,10,teal);text(contentsPage,String(i+1),x+15,iy+16,20,10,bold,white,12);
    let y=text(contentsPage,step.title,x+9,iy+43,rw-18,11,bold,ink,14)+6;text(contentsPage,step.body,x+9,y,rw-18,9,regular,muted,12);
  }
  iy+=roadmapHeight+22;iy=text(contentsPage,'Jump to a page',M,iy,CW,18,bold,ink,24)+12;
  const colW=(CW-25)/2,half=Math.ceil(index.length/2);
  for(let column=0;column<2;column++){
    let y=iy;const x=M+column*(colW+25);
    for(const entry of index.slice(column*half,(column+1)*half)){
      const target=destinations.get(entry.key),number=pages.findIndex(p=>p.page===target.page)+1;
      const h=Math.max(25,textHeight(entry.title,colW-28,9.6,regular,13)+10);
      if(y+h>BOTTOM)throw Error('The contents text is too long. Shorten the guide titles and try again.');
      text(contentsPage,entry.title,x,y,colW-28,9.6,regular,ink,13);text(contentsPage,String(number),x+colW-22,y,22,9.6,bold,teal,13);rule(contentsPage,x,y+h-5,colW);clickable(contentsPage,x,y-2,colW,h,entry.key);y+=h;
    }
  }
  // Running folios and a return link on every inside page.
  for(const [i,entry] of pages.entries()){
    const {page,dark}=entry;if(dark)continue;
    rule(page,M,800,CW);text(page,'TSAAT USER GUIDE',M,813,150,7.8,bold,muted,10);
    text(page,'Contents  /  Glossary',W/2-47,813,110,8,regular,teal,10);clickable(page,W/2-49,807,44,20,'contents');clickable(page,W/2+2,807,50,20,'glossary');
    text(page,String(i+1).padStart(2,'0')+' / '+pages.length,W-M-50,813,50,8,bold,muted,10);
  }
  for(const l of links){
    const target=destinations.get(l.key);if(!target)continue;
    const annotation=doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[l.x,H-l.top-l.height,l.x+l.width,H-l.top],Border:[0,0,0],Dest:[target.page.ref,'XYZ',null,H-target.top,null]}));
    l.page.node.addAnnot(annotation);
  }
  report('Finishing your '+pages.length+'-page guide...');
  return {bytes:await doc.save(),pages:pages.length};
}
async function generateGuidePdf(){
  const status=message=>{pdfGuideStatus=message;const el=byId('pdf-status');if(el)el.textContent=message;};
  if(pdfGuideBusy){status('Your PDF is being prepared.');return;}
  pdfGuideBusy=true;
  const button=byId('generate-guide-pdf');if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
  status('Preparing your illustrated user guide...');
  // Snapshot the loaded workbook so edits or navigation during generation cannot mix editions.
  const edition=new Map([...copy].map(([key,item])=>[key,item.text]));
  const get=key=>{if(!edition.has(key))throw Error('Guide text is missing: '+key);return edition.get(key);};
  try{
    await new Promise(resolve=>setTimeout(resolve,0));
    const result=await createGuidePdf(get,status);
    download(new Blob([result.bytes],{type:'application/pdf'}),'TSAAT-User-Guide.pdf');
    status('Your '+result.pages+'-page PDF is ready. Check your browser downloads.');
  }catch(error){console.error('Guide PDF generation failed:',error);status('The PDF could not be created. '+(error.message||'Try again.'));}
  finally{pdfGuideBusy=false;const current=byId('generate-guide-pdf');if(current){current.disabled=false;current.removeAttribute('aria-busy');}}
}
document.addEventListener('click',event=>{if(event.target.closest('[data-action="generate-pdf"]')){event.preventDefault();generateGuidePdf();}});

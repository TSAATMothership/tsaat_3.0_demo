'use strict';
exports.scenes=[
  {captions:['Open End Point Insights and read the four evidence totals.','Check the snapshot: older discoveries and missing evidence have different meanings.']},
  {captions:['Open Missing details and inspect a field-level gap.','The linked explorer shows the affected rows. Missing-field counts can overlap.']},
  {captions:['Open Discovery evidence to check when records were observed and by which source.','Follow Older discoveries to review observations more than 30 days before the snapshot.']},
  {captions:['Read Coverage context and its required tool-check denominator.','One CI can require several checks; CIs without required mappings are outside the percentage.']},
  {captions:['Investigate unidentified nodes in Shadow IT Explorer.','Return to the briefing and Generate PDF to share the evidence and next steps.']},
];
exports.run=async({app,ready,open,record,caption,point,click,download})=>{
  const briefing=()=>open('End Point Insights','Governance');
  await record(0,async at=>{
    await at(.5,briefing);
    await at(3,()=>point(app.getByRole('region',{name:'Endpoint evidence at a glance'})));
    await at(6.5,()=>caption(0,1));
    await at(8,()=>point(app.getByLabel('Data date')));
  });
  await record(1,async at=>{
    await at(1,()=>click(app.getByRole('link',{name:'02Missing details',exact:true})));
    await at(3,()=>point(app.getByRole('link',{name:'Inspect missing mac address',exact:true})));
    await at(6.5,()=>caption(1,1));
    await at(7,()=>click(app.getByRole('link',{name:'Inspect missing mac address',exact:true})));
    await ready();
    await at(9,()=>point(app.getByRole('button',{name:'Clear MAC Address filter',exact:true})));
  });
  await record(2,async at=>{
    await at(.5,briefing);
    await at(3,()=>click(app.getByRole('link',{name:'03Discovery evidence',exact:true})));
    await at(6.5,()=>caption(2,1));
    await at(8,()=>click(app.getByRole('link',{name:'Review 37 older discoveries',exact:true})));
    await ready();
    await at(10,()=>point(app.getByRole('button',{name:'Export Excel',exact:true})));
  });
  await record(3,async at=>{
    await at(.5,briefing);
    await at(3,()=>click(app.getByRole('link',{name:'04Coverage context',exact:true})));
    await at(5,()=>point(app.getByRole('img',{name:'91.6% required CI tool coverage',exact:true})));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>point(app.getByRole('heading',{name:'962 of 1,050 required checks covered',exact:true})));
  });
  await record(4,async at=>{
    await at(1,()=>click(app.getByRole('link',{name:'Investigate unidentified nodes',exact:true})));
    await ready('Shadow IT Explorer');
    await at(4,()=>point(app.locator('.endpoint-total')));
    await at(6.5,()=>caption(4,1));
    await at(7,briefing);
    await at(9,()=>download(app.getByRole('button',{name:'Generate End Point Insights PDF',exact:true})));
  });
};

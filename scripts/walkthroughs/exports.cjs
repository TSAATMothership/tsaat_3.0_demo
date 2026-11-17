'use strict';
exports.scenes=[
  {captions:['Open a Governance briefing and choose Generate PDF.','The briefing uses the applied header scope and snapshot.']},
  {captions:['Open an explorer and filter the inventory you want to share.','Export Excel includes all matching rows, with an export timestamp in UTC.']},
  {captions:['Open Topology Explorer and choose a starting CI.','Choose the analysis mode and review the graph before generating an Impact Report.']},
  {captions:['Generate the report and wait for the progress dialog to finish.','Before sharing, check the downloaded file against the scope, snapshot and records.']},
];
exports.run=async({app,open,record,caption,point,click,download,assert})=>{
  await record(0,async at=>{
    await at(.5,()=>open('End Point Insights','Governance'));
    await at(3,()=>download(app.getByRole('button',{name:'Generate End Point Insights PDF',exact:true})));
    await at(6.5,()=>caption(0,1));
    await at(8,()=>point(app.getByRole('button',{name:/^Managed Network/})));
  });
  await record(1,async at=>{
    await at(.5,()=>open('End Point Explorer'));
    await at(3,()=>click(app.getByRole('button',{name:'CI type: Server, 135 records',exact:true})));
    await at(6.5,()=>caption(1,1));
    await at(8,()=>download(app.getByRole('button',{name:'Export Excel',exact:true})));
    await at(10,()=>point(app.getByRole('button',{name:'Clear CI Type filter',exact:true})));
  });
  await record(2,async at=>{
    await at(.5,()=>open('Topology Explorer'));
    await at(3,()=>click(app.locator('[data-topology-result]').first()));
    await at(6.5,()=>caption(2,1));
    await at(8,()=>point(app.getByRole('tab',{name:'Business Impact',exact:true})));
    await at(10,()=>point(app.locator('.topology-canvas')));
  });
  await record(3,async at=>{
    await at(1,async()=>{const name=await download(app.getByRole('button',{name:'Generate Impact Report',exact:true}));assert.match(name,/\.pdf$/i);});
    await at(6.5,()=>caption(3,1));
    await at(8,()=>point(app.getByLabel('Data date')));
    await at(10,()=>point(app.locator('.topology-canvas')));
  });
};

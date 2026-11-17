'use strict';
exports.scenes=[
  {captions:['Choose a product from the chart, then open the Software Version column menu.','Select the exact recorded version and check the applied filter chips.']},
  {captions:['Compare the host operating systems and discovery sources.','Check Last discovered against the snapshot; each row is an installation record.']},
  {captions:['Read the installed version and file path alongside the host device.','Select the linked device name to inspect its CMDB details.']},
  {captions:['Close the host panel and confirm the matching installation count.','Export Excel and ask the owner to confirm the versions, paths and deployment context.']},
];
exports.run=async({app,open,record,caption,point,click,download})=>{
  await record(0,async at=>{
    await at(.3,()=>open('Installed Software Explorer'));
    await at(2,()=>click(app.getByRole('button',{name:'Software products: Node.js Runtime, 76 records',exact:true})));
    await at(4,()=>click(app.getByRole('button',{name:'Filter Software Version',exact:true})));
    await at(6.5,()=>caption(0,1));
    await at(7,()=>click(app.getByRole('checkbox',{name:/^20 /})));
    await at(9,()=>click(app.getByRole('button',{name:'Close Software Version filter',exact:true})));
    await at(11,()=>point(app.getByRole('button',{name:'Clear Software Version filter',exact:true})));
  });
  await record(1,async at=>{
    await at(1,()=>point(app.getByRole('region',{name:'Endpoint operating systems summary chart'})));
    await at(4,()=>point(app.getByRole('region',{name:'Discovered by summary chart'})));
    await at(6.5,()=>caption(1,1));
    await at(8,()=>point(app.getByRole('region',{name:'Last discovered summary chart'})));
  });
  await record(2,async at=>{
    await at(1,()=>point(app.getByRole('cell',{name:'/opt/node.js-runtime/20/bin/node.js-runtime',exact:true}).first()));
    await at(4,()=>point(app.getByRole('button',{name:'Open CMDB Drill Through for Server 5',exact:true})));
    await at(6.5,()=>caption(2,1));
    await at(8,()=>click(app.getByRole('button',{name:'Open CMDB Drill Through for Server 5',exact:true})));
    await at(10,()=>point(app.getByRole('row',{name:'Asset ID srv-0005',exact:true})));
  });
  await record(3,async at=>{
    await at(.5,()=>click(app.getByRole('button',{name:'Close CMDB Drill Through'})));
    await at(3,()=>point(app.getByRole('region',{name:'Installed software results'}).getByRole('status')));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>download(app.getByRole('button',{name:'Export Excel',exact:true})));
  });
};

'use strict';
exports.scenes=[
  {captions:['Open Shadow IT Explorer and choose an approach such as ARP Table.','Check the matching IP-node count; the two discovery approaches represent different evidence.']},
  {captions:['Check who collected the observation and when it was last discovered.','For ARP observations, also check the CI type of the endpoint that supplied the table.']},
  {captions:['Compare the unidentified IP address with the linked End Point Name.','The linked CMDB panel describes the observer. IP Scan records show N/A for the ARP owner.']},
  {captions:['Close the panel and keep the observation address and date with the result.','Export the matching IP nodes so the owner can compare address assignments and CMDB records.']},
];
exports.run=async({app,open,record,caption,point,click,download,assert})=>{
  await record(0,async at=>{
    await at(.5,()=>open('Shadow IT Explorer'));
    await at(3,()=>click(app.getByRole('button',{name:'Discovery approach: ARP Table, 15 records',exact:true})));
    await at(6.5,()=>caption(0,1));
    await at(8,()=>point(app.getByRole('region',{name:'Shadow IT results'}).getByRole('status')));
  });
  await record(1,async at=>{
    await at(1,()=>point(app.getByRole('region',{name:'Discovered by summary chart'})));
    await at(4,()=>point(app.getByRole('region',{name:'Last discovered summary chart'})));
    await at(6.5,()=>caption(1,1));
    await at(8,()=>point(app.getByRole('region',{name:'ARP table owner CI type summary chart'})));
  });
  await record(2,async at=>{
    await at(1,()=>point(app.getByRole('cell',{name:'10.88.0.28',exact:true})));
    const observer=app.getByRole('button',{name:'Open CMDB Drill Through for Edge Device 22',exact:true}).first();
    await at(4,()=>point(observer));
    await at(6.5,()=>caption(2,1));
    await at(7,()=>click(observer));
    await at(9,()=>point(app.getByRole('row',{name:'IP Address 10.77.0.22',exact:true})));
  });
  await record(3,async at=>{
    await at(.5,()=>click(app.getByRole('button',{name:'Close CMDB Drill Through'})));
    await at(3,()=>point(app.getByRole('cell',{name:'10.88.0.28',exact:true})));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>download(app.getByRole('button',{name:'Export Excel',exact:true})));
    assert.match(await app.getByRole('region',{name:'Shadow IT results'}).getByRole('status').innerText(),/15 matching records/);
  });
};

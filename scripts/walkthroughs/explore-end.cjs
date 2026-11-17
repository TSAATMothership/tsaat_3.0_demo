'use strict';
exports.scenes=[
  {captions:['Open End Point Explorer and check the applied scope and snapshot.','Use the CI type, network, discovery source and observation-age charts to understand the inventory.']},
  {captions:['Search for a recorded name, identifier or address, then open a column filter.','Tick an exact value in the menu and check the matching records.']},
  {captions:['Clear the earlier filters and select an observation-age category.','Open a linked endpoint name to inspect the CMDB record and its snapshot.']},
  {captions:['Close the record panel and confirm the matching-record count.','Export Excel preserves all matching rows for follow-up with the endpoint owner.']},
];
exports.run=async({app,open,record,caption,point,click,download,assert})=>{
  await record(0,async at=>{
    await at(.5,()=>open('End Point Explorer'));
    await at(3,()=>point(app.locator('.endpoint-total')));
    await at(6.5,()=>caption(0,1));
    await at(8,()=>point(app.getByRole('region',{name:'Last discovered summary chart'})));
  });
  await record(1,async at=>{
    const search=app.getByRole('searchbox',{name:'Search all endpoint fields'});
    await at(1,async()=>{await click(search);await search.pressSequentially('10.77.0.105',{delay:80});});
    await at(4,()=>click(app.getByRole('button',{name:'Filter Name',exact:true})));
    await at(6.5,()=>caption(1,1));
    await at(7,()=>click(app.getByRole('checkbox',{name:/^Server 5 /})));
    await at(9,()=>click(app.getByRole('button',{name:'Close Name filter',exact:true})));
    await at(11,()=>point(app.getByRole('button',{name:'Clear Name filter',exact:true})));
  });
  await record(2,async at=>{
    await at(.5,()=>click(app.getByRole('button',{name:'Clear all filters',exact:true})));
    await at(3,()=>click(app.getByRole('button',{name:'Last discovered: Over 90 days, 17 records',exact:true})));
    await at(6.5,()=>caption(2,1));
    await at(8,()=>click(app.getByRole('button',{name:'Open CMDB Drill Through for Server 7',exact:true})));
    await at(10,()=>point(app.getByRole('row',{name:'Asset ID srv-0007',exact:true})));
  });
  await record(3,async at=>{
    await at(.5,()=>click(app.getByRole('button',{name:'Close CMDB Drill Through'})));
    const count=app.getByRole('region',{name:'Endpoint results'}).getByRole('status');
    await at(3,()=>point(count));assert.match(await count.innerText(),/17 matching records/);
    await at(6.5,()=>caption(3,1));
    await at(8,()=>download(app.getByRole('button',{name:'Export Excel',exact:true})));
  });
};

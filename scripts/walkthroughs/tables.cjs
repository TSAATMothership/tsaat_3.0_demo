'use strict';
exports.scenes=[
  {captions:['Open End Point Explorer and check the total records in scope.','Chart bars summarise the inventory; the table shows matching records.']},
  {captions:['Click a chart bar to filter the records, then open a column filter.','Select an exact value from the column menu to narrow the result further.']},
  {captions:['Check the filter chips. Remove a chip or choose Clear all filters.','Use the search box to find a name, identifier or other recorded value.']},
  {captions:['Select a linked name to inspect its CMDB record, then close the panel.','Export Excel downloads every matching record, across all table pages.']},
];
exports.run=async({app,open,record,caption,point,click,download,assert})=>{
  await record(0,async at=>{
    await at(1,()=>open('End Point Explorer'));
    await at(4,()=>point(app.locator('.endpoint-total')));
    await at(6.5,()=>caption(0,1));
    await at(8,()=>point(app.getByRole('region',{name:'CI type summary chart'})));
  });
  await record(1,async at=>{
    await at(1,()=>click(app.getByRole('button',{name:'CI type: Server, 135 records',exact:true})));
    await at(4,()=>click(app.getByRole('button',{name:'Filter Security Domain',exact:true})));
    await at(6.5,()=>caption(1,1));
    await at(7,()=>click(app.getByRole('checkbox',{name:/^UNKNOWN /})));
    await at(10,()=>click(app.getByRole('button',{name:'Close Security Domain filter'})));
    await at(11,()=>point(app.getByRole('button',{name:'Clear Security Domain filter',exact:true})));
  });
  await record(2,async at=>{
    await at(1,()=>point(app.getByRole('button',{name:'Clear Security Domain filter',exact:true})));
    await at(3,()=>click(app.getByRole('button',{name:'Clear all filters',exact:true})));
    await at(6.5,()=>caption(2,1));
    const search=app.getByRole('searchbox',{name:'Search all endpoint fields'});
    await at(7,async()=>{await click(search);await search.pressSequentially('10.77.0.105',{delay:90});});
    await at(10,()=>point(app.getByRole('button',{name:'Open CMDB Drill Through for Server 5',exact:true})));
  });
  await record(3,async at=>{
    await at(1,()=>click(app.getByRole('button',{name:'Open CMDB Drill Through for Server 5',exact:true})));
    await at(3,()=>point(app.getByRole('dialog')));
    await at(5.5,()=>click(app.getByRole('button',{name:'Close CMDB Drill Through'})));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>download(app.getByRole('button',{name:'Export Excel',exact:true})));
    assert.match(await app.getByRole('region',{name:'Endpoint results'}).innerText(),/1 matching record/);
  });
};

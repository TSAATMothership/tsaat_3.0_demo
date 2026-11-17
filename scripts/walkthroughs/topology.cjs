'use strict';
exports.scenes=[
  {captions:['Open a lookup filter and search for the CIs you want to examine.','Select matching values. Values within a field combine with OR; different fields combine with AND.']},
  {captions:['Show all matching results together in Impact Topology.','Select one result to return to a graph with a single starting CI.']},
  {captions:['Use Business Impact to see the model relationships around the starting CI.','For a model, this view shows the higher-level context; member endpoints appear in Dependencies.']},
  {captions:['Switch to Dependencies to include recorded model dependencies and member endpoints.','Expand Relationship evidence to inspect each source, relationship, target and environment.']},
  {captions:['Select a graph node to read its details and connections.','Explore from this CI changes the starting point. Choose a layout and use Fit graph.']},
  {captions:['Generate Impact Report for the current mode and starting CI or group.','The report includes the full graph and evidence. Keep its scope, snapshot and starting point together.']},
];
exports.run=async({app,open,record,caption,point,click,download,assert})=>{
  const graph=app.locator('.topology-canvas');
  const evidence=app.locator('summary').filter({hasText:'Relationship evidence'});
  await record(0,async at=>{
    await at(.3,()=>open('Topology Explorer'));
    await at(2,()=>click(app.getByRole('button',{name:'Filter CI name or ID',exact:true})));
    const search=app.getByRole('searchbox',{name:'Search CI name or ID values'});
    await at(3.5,async()=>{await click(search);await search.pressSequentially('Mission',{delay:100});});
    await at(6.5,()=>caption(0,1));
    await at(7,()=>click(app.getByRole('button',{name:'Select matches',exact:true})));
    await at(9,()=>click(app.getByRole('button',{name:'Close CI name or ID filter',exact:true})));
    await at(11,()=>point(app.getByRole('complementary',{name:'CI lookup results'}).getByRole('status')));
  });
  await record(1,async at=>{
    await at(1,()=>click(app.getByRole('button',{name:'Show all results in Impact Topology',exact:true})));
    await at(4,()=>point(graph));
    await at(6.5,()=>caption(1,1));
    await at(8,()=>click(app.getByRole('button',{name:'SYS Mission System 16 ICT System sys-16',exact:true})));
    await at(10,()=>point(graph));
  });
  await record(2,async at=>{
    await at(1,()=>click(app.getByRole('tab',{name:'Business Impact',exact:true})));
    await at(4,()=>point(graph.getByRole('button',{name:'Managed Network: Aegis Mesh North',exact:true})));
    await at(6.5,()=>caption(2,1));
    await at(8,()=>point(graph));
  });
  await record(3,async at=>{
    await at(1,()=>click(app.getByRole('tab',{name:'Dependencies',exact:true})));
    await at(4,()=>point(graph));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>click(evidence));
    await at(10,()=>point(app.getByRole('button',{name:'Filter Source CI',exact:true})));
  });
  await record(4,async at=>{
    await at(.3,()=>click(evidence));
    await at(1.5,()=>click(app.getByRole('tab',{name:'Business Impact',exact:true})));
    await at(3,()=>click(graph.getByRole('button',{name:'Business Service: Mission Planning Platform',exact:true})));
    await at(4.5,()=>point(app.getByRole('region',{name:'Selected node details'}).getByRole('heading',{name:'Mission Planning Platform',exact:true})));
    await at(6.5,()=>caption(4,1));
    await at(7,()=>click(app.getByRole('button',{name:'Explore from this CI',exact:true})));
    await at(9,async()=>{const layout=app.getByRole('combobox',{name:'Topology layout'});await point(layout);await layout.selectOption({label:'Radial'});});
    await at(11,()=>click(app.getByRole('button',{name:'Fit graph',exact:true})));
  });
  await record(5,async at=>{
    await at(1,async()=>{const file=await download(app.getByRole('button',{name:'Generate Impact Report',exact:true}));assert.match(file,/\.pdf$/i);});
    await at(6.5,()=>caption(5,1));
    await at(8,()=>point(app.getByLabel('Data date')));
    await at(10,()=>point(graph));
  });
};

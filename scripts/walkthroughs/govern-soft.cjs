'use strict';
exports.scenes=[
  {captions:['Start with recorded installations, named products, endpoints and version evidence.','One endpoint can have many installations; these totals describe different things.']},
  {captions:['Open Concentration and review the leading products.','The three-product share uses all installations as its denominator, including unnamed records.']},
  {captions:['Open Version variation and choose a product with multiple recorded versions.','The filtered explorer lets you compare versions, paths, sources and host devices.']},
  {captions:['Read Evidence priorities to choose a collection or verification task.','These gaps overlap. Follow a review link to inspect the affected records.']},
  {captions:['Export the filtered evidence to Excel for follow-up with the software owner.','Return to the briefing and Generate PDF to share the scoped summary.']},
];
exports.run=async({app,ready,open,record,caption,point,click,download,assert})=>{
  const briefing=()=>open('Installed Software Insights','Governance');
  await record(0,async at=>{
    await at(.5,briefing);
    await at(3,()=>point(app.getByRole('region',{name:'Software at a glance'})));
    await at(6.5,()=>caption(0,1));
    await at(8,()=>point(app.locator('#software-briefing-footprint h2')));
  });
  await record(1,async at=>{
    await at(1,()=>click(app.getByRole('link',{name:'02Concentration',exact:true})));
    await at(4,()=>point(app.locator('#software-briefing-concentration').getByRole('link',{name:'Node.js Runtime',exact:true})));
    await at(6.5,()=>caption(1,1));
    await at(8,()=>point(app.locator('#software-briefing-concentration h2')));
  });
  await record(2,async at=>{
    await at(.5,()=>click(app.getByRole('link',{name:'03Version variation',exact:true})));
    const product=app.locator('#software-briefing-variation').getByRole('link',{name:'Node.js Runtime',exact:true});
    await at(3,()=>point(product));
    await at(6.5,()=>caption(2,1));
    await at(7,()=>click(product));await ready('Installed Software Explorer');
    await at(9,()=>point(app.getByRole('button',{name:'Filter Software Version',exact:true})));
    assert.match(app.url(),/Node.js/);
  });
  await record(3,async at=>{
    await at(.5,briefing);
    await at(3,()=>click(app.getByRole('link',{name:'04Evidence priorities',exact:true})));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>click(app.getByRole('link',{name:'Review 154 records',exact:true})));
    await ready('Installed Software Explorer');
    await at(10,()=>point(app.getByRole('button',{name:'Export Excel',exact:true})));
  });
  await record(4,async at=>{
    await at(1,()=>download(app.getByRole('button',{name:'Export Excel',exact:true})));
    await at(4,briefing);
    await at(6.5,()=>caption(4,1));
    await at(8,()=>download(app.getByRole('button',{name:'Generate Software Insights PDF',exact:true})));
  });
};

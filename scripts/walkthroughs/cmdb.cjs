'use strict';
exports.scenes=[
  {captions:['Select a linked CI name in the inventory table.','Check the record name, Asset ID and snapshot before interpreting the details.']},
  {captions:['Read the Field and Value pairs; search within the detail table if needed.','Available fields vary by CI type. Missing values need follow-up with the owner.']},
  {captions:['Choose Explore Topology to use this CI as the starting point.','The topology uses the panel snapshot; inventory table filters do not carry across.']},
  {captions:['Return to the explorer and open the record again.','Press Escape or Close to return to the control that opened the panel.']},
];
exports.run=async({app,ready,open,record,caption,point,click,assert})=>{
  const link=app.getByRole('button',{name:'Open CMDB Drill Through for Server 5',exact:true});
  await record(0,async at=>{
    await at(1,()=>click(link));
    await at(4,()=>point(app.getByRole('dialog').getByRole('row',{name:'Asset ID srv-0005',exact:true})));
    await at(6.5,()=>caption(0,1));
    await at(8,()=>point(app.getByRole('dialog').locator('p').filter({hasText:'Asset details for'})));
  });
  await record(1,async at=>{
    const search=app.getByRole('searchbox',{name:'Search asset details table'});
    await at(1,async()=>{await click(search);await search.pressSequentially('Operating',{delay:100});});
    await at(4,()=>point(app.getByRole('row',{name:/Operating System Canonical/})));
    await at(6.5,()=>caption(1,1));
    await at(8,async()=>{await click(search);await search.fill('');});
  });
  await record(2,async at=>{
    await at(1,()=>point(app.getByRole('button',{name:'Explore Topology',exact:true})));
    await at(3,()=>click(app.getByRole('button',{name:'Explore Topology',exact:true})));
    await ready('Topology Explorer');
    await at(6.5,()=>caption(2,1));
    await at(8,()=>point(app.locator('.topology-canvas')));
    assert.match(app.url(),/srv-0005/);
  });
  await record(3,async at=>{
    await at(.5,()=>open('End Point Explorer'));
    await at(3,()=>click(link));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>app.keyboard.press('Escape'));
    await app.getByRole('dialog').waitFor({state:'hidden'});
    await app.waitForFunction(el=>el===document.activeElement,await link.elementHandle());
    assert.equal(await link.evaluate(el=>el===document.activeElement),true);
    await at(10,()=>point(link));
  });
};

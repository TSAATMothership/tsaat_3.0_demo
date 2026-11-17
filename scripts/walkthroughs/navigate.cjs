'use strict';
exports.scenes=[
  {captions:['Expand Governance to see its three briefing pages.','Expand Discovery and open End Point Explorer.']},
  {captions:['Check Persona when pages or actions seem to be missing.','Business Reporting shows the pages available to that persona.']},
  {captions:['Choose All sections (no persona) to restore the full navigation.','If personas fail to load, use Retry loading personas when it appears.']},
  {captions:['Apply a header selection with Update before leaving the page.','Open another explorer: the applied network, domains and date carry across.']},
];
exports.run=async({app,ready,open,record,caption,point,click,assert})=>{
  await record(0,async at=>{
    await at(1,()=>click(app.getByRole('button',{name:'Governance',exact:true})));
    await at(4,()=>point(app.getByRole('link',{name:'End Point Insights',exact:true})));
    await at(6.5,()=>caption(0,1));
    await at(7,()=>open('End Point Explorer'));
  });
  await record(1,async at=>{
    const persona=app.getByLabel('Active persona');
    await at(1,()=>point(persona));
    await at(3,()=>persona.selectOption({label:'Business Reporting'}));
    await at(6.5,()=>caption(1,1));
    await at(8,()=>point(app.getByRole('navigation',{name:'Views'})));
  });
  await record(2,async at=>{
    const persona=app.getByLabel('Active persona');
    await at(1,()=>point(persona));
    await at(3,()=>persona.selectOption({label:'All sections (no persona)'}));
    await at(5,()=>open('End Point Explorer'));
    await at(6.5,()=>caption(2,1));
    await at(9,()=>point(app.getByRole('navigation',{name:'Views'})));
  });
  await record(3,async at=>{
    await at(.5,()=>click(app.getByRole('button',{name:/^Managed Network/})));
    await at(2,()=>click(app.getByRole('checkbox',{name:'Citadel Fusion Central',exact:true})));
    await at(4,()=>click(app.getByRole('button',{name:'Update Managed Network filter'})));
    await ready();
    await at(6.5,()=>caption(3,1));
    await at(7,()=>open('Installed Software Explorer'));
    assert.match(app.url(),/net-1%2Cnet-5/);
    await at(10,()=>point(app.getByRole('button',{name:/^Managed Network/})));
  });
};

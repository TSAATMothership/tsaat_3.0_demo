'use strict';
exports.scenes=[
  {captions:['Read the observation, CVE, endpoint and critical/high totals as different measures.','Follow a severity link to inspect its underlying vulnerability observations.']},
  {captions:['Open Evidence gaps and check the missing version, remediation and source fields.','Expand the remaining fields. Gap counts can overlap on the same observation.']},
  {captions:['Open Sources & context to review affected software, platforms, sources and dates.','Follow a detection source to see the observations it supplied.']},
  {captions:['Read Discovery coverage as supporting inventory evidence.','Required discovery checks cover scoped CIs, including those with no vulnerability observations.']},
  {captions:['Review the critical/high observations and validate affected versions and remediation.','Return to the briefing and Generate PDF for the applied scope and snapshot.']},
];
exports.run=async({app,ready,open,record,caption,point,click,download})=>{
  const briefing=()=>open('Security Vulnerability Insights','Governance');
  await record(0,async at=>{
    await at(.5,briefing);
    await at(3,()=>point(app.getByRole('region',{name:'Vulnerability evidence at a glance'})));
    await at(6.5,()=>caption(0,1));
    await at(8,()=>click(app.getByRole('link',{name:'Critical 122',exact:true})));
    await ready('Security Vulnerability Explorer');
  });
  await record(1,async at=>{
    await at(.5,briefing);
    await at(3,()=>click(app.getByRole('link',{name:'02Evidence gaps',exact:true})));
    await at(5,()=>point(app.getByRole('link',{name:'Review missing remediation action',exact:true})));
    await at(6.5,()=>caption(1,1));
    await at(8,()=>click(app.locator('summary').filter({hasText:'Inspect the other 9 fields'})));
  });
  await record(2,async at=>{
    await at(1,()=>click(app.getByRole('link',{name:'03Sources & context',exact:true})));
    await at(4,()=>point(app.getByRole('heading',{name:'Where did the evidence come from?',exact:true})));
    await at(6.5,()=>caption(2,1));
    await at(8,()=>click(app.getByRole('link',{name:'Qualys 107',exact:true})));
    await ready('Security Vulnerability Explorer');
    await at(10,()=>point(app.getByRole('button',{name:'Export Excel',exact:true})));
  });
  await record(3,async at=>{
    await at(.5,briefing);
    await at(3,()=>click(app.getByRole('link',{name:'04Discovery coverage',exact:true})));
    await at(5,()=>point(app.getByRole('img',{name:'91.6% required CI tool coverage',exact:true})));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>point(app.getByRole('heading',{name:'962 of 1,050 required checks covered',exact:true})));
  });
  await record(4,async at=>{
    await at(.5,()=>click(app.getByRole('link',{name:'Review 276 critical / high observations',exact:true})));
    await ready('Security Vulnerability Explorer');
    await at(3,()=>point(app.getByRole('button',{name:'Filter Installed Version',exact:true})));
    await at(6.5,()=>caption(4,1));
    await at(7,briefing);
    await at(9,()=>download(app.getByRole('button',{name:'Generate Security Vulnerability Insights PDF',exact:true})));
  });
};

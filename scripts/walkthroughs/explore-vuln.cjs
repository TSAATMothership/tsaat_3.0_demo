'use strict';
exports.scenes=[
  {captions:['Choose a severity category, then search for a CVE code.','Check the matching observations and the active severity filter.']},
  {captions:['Read the affected software and installed version for each observation.','Scroll across to read the recorded remediation, severity and detection source.']},
  {captions:['Date Detected belongs to the observation on the endpoint.','Date CVE Code Created is the CVE reservation date; it is a different event.']},
  {captions:['Open the linked device name to check its CMDB context, then close the panel.','Valid CVE codes link to an external record. Export Excel shares the filtered observations.']},
];
exports.run=async({app,open,record,caption,point,click,download})=>{
  await record(0,async at=>{
    await at(.5,()=>open('Security Vulnerability Explorer'));
    await at(2,()=>click(app.getByRole('button',{name:'Severity: Medium, 124 records',exact:true})));
    const search=app.getByRole('searchbox',{name:'Search security vulnerabilities table'});
    await at(4,async()=>{await click(search);await search.pressSequentially('CVE-2021-23017',{delay:75});});
    await at(6.5,()=>caption(0,1));
    await at(8,()=>point(app.getByRole('region',{name:'Security vulnerabilities results'}).getByRole('status')));
  });
  await record(1,async at=>{
    await at(1,()=>point(app.getByRole('button',{name:'Filter Affected Software',exact:true})));
    await at(4,()=>point(app.getByRole('button',{name:'Filter Installed Version',exact:true})));
    await at(6.5,()=>caption(1,1));
    await at(8,()=>point(app.getByRole('button',{name:'Filter Remediation Action',exact:true})));
  });
  await record(2,async at=>{
    await at(1,()=>point(app.getByRole('button',{name:'Filter Date Detected',exact:true})));
    await at(6.5,()=>caption(2,1));
    await at(8,()=>point(app.getByRole('button',{name:'Filter Date CVE Code Created',exact:true})));
  });
  await record(3,async at=>{
    await at(1,()=>click(app.getByRole('button',{name:'Open CMDB Drill Through for Server 13',exact:true})));
    await at(3,()=>point(app.getByRole('row',{name:'Asset ID srv-0013',exact:true})));
    await at(5,()=>click(app.getByRole('button',{name:'Close CMDB Drill Through'})));
    await at(6.5,()=>caption(3,1));
    await at(8,()=>download(app.getByRole('button',{name:'Export Excel',exact:true})));
  });
};

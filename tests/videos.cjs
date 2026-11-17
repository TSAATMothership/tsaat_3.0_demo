'use strict';
// Check each topic separately so decoding does not keep every video in memory.
const path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {topics}=require('../src/structure.json');
for(const topic of Object.keys(topics)){
  execFileSync(process.execPath,[path.join(__dirname,topic==='scope'?'scope-video.cjs':'topic-video.cjs'),topic],{cwd:root,stdio:'inherit'});
}

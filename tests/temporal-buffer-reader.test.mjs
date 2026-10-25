import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCompositionTemporalProjectionReader,projectTemporalBufferCoverage} from '../dist/index.js';
const sample=(time,value,stage='simulated',source='occurrence:a')=>({timeSeconds:time,metadata:{subjectId:'clip:a',projectionStage:stage},viewer:{physics:stage==='simulated'?{bodyTransforms:[{id:'body',position:{x:time,y:0,z:0},rotation:{x:0,y:0,z:0,w:1}}]}:undefined,joints:{joint:value},playback:{sourceId:source,currentTime:time,duration:2,isPlaying:false}}});
const cursor=time=>({animationId:'clip:a',sourceId:'occurrence:a',currentTimeSeconds:time,projectionStage:'simulated',allowAuthoredFallback:false});
test('independent readers project the same indexed history and reject gaps or another occurrence',()=>{
 const history={samples:[sample(0,0),sample(.1,1),sample(1,99),sample(.05,80,'simulated','occurrence:b')]};
 const one=createCompositionTemporalProjectionReader(),two=createCompositionTemporalProjectionReader();
 assert.deepEqual(one(history,cursor(.05)),two(history,cursor(.05)));
 assert.equal(one(history,cursor(.05)).viewer.joints.joint,.5);
 assert.equal(one(history,cursor(.5)),null);
 assert.equal(one(history,{...cursor(.05),sourceId:'missing'}),null);
});
test('a physical reader does not silently replace a missing result with authored data',()=>{
 const history={samples:[sample(0,2,'authored'),sample(.1,4,'authored')]};
 const reader=createCompositionTemporalProjectionReader();
 assert.equal(reader(history,cursor(.05)),null);
 assert.equal(reader(history,{...cursor(.05),allowAuthoredFallback:true}).viewer.joints.joint,3);
});
test('buffer coverage distinguishes authored and simulated evidence and preserves holes',()=>{
 const coverage=projectTemporalBufferCoverage({samples:[sample(0,0),sample(.1,1),sample(1,9),sample(0,2,'authored')]});
 assert.deepEqual(coverage.find(c=>c.stage==='simulated').ranges,[{startSeconds:0,endSeconds:.1},{startSeconds:1,endSeconds:1}]);
 assert.deepEqual(coverage.find(c=>c.stage==='authored').ranges,[{startSeconds:0,endSeconds:0}]);
});

test('an incomplete simulated sample without physical body observations is refused',()=>{
 const value=sample(0,0);delete value.viewer.physics;
 assert.equal(createCompositionTemporalProjectionReader()({samples:[value]},cursor(0)),null);
});

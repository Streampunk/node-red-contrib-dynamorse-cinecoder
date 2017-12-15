/* Copyright 2017 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const TestUtil = require('dynamorse-test');

const packerTestNode = () => ({
  type: 'packer',
  z: TestUtil.testFlowId,
  name: 'packer-test',
  x: 300.0,
  y: 100.0,
  wires: [[]]
});

const encodeTestNode = () => ({
  type: 'Cinecoder encoder',
  z: TestUtil.testFlowId,
  name: 'encode-test',
  maxBuffer: 10,
  wsPort: TestUtil.properties.wsPort,
  x: 700.0,
  y: 100.0,
  wires: [[]]
});

const decodeTestNode = () => ({
  type: 'Cinecoder decoder',
  z: TestUtil.testFlowId,
  name: 'decode-test',
  x: 900.0,
  y: 100.0,
  wires: [[]]
});

const funnelNodeId = '24fde3d7.b7544c';
const packer1NodeId = '145f639d.4b63ac';
const packer2NodeId = '5c14afb6.b1cf3';
const encoderNodeId = '7c968c40.836974';
const decoderNodeId = '634c3672.78be18';
const spoutNodeId = 'f2186999.7e5f78';

TestUtil.nodeRedTest('A src->packer->encoder->decoder->spout flow is posted to Node-RED', {
  numPushes: 10,
  funnelMaxBuffer: 10,
  packer1Fmt: 'pgroup',
  packer2Fmt: 'UYVY10',
  packerMaxBuffer: 10,
  encodeFmt: 'AVCi 100',
  encoderMaxBuffer: 10,
  decoderMaxBuffer: 10,
  decoderFmt: 'UYVY10',
  spoutTimeout: 0
}, (params) => {
  const testFlow = TestUtil.testNodes.baseTestFlow();
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.funnelGrainNode(), {
    id: funnelNodeId,
    numPushes: params.numPushes,
    maxBuffer: params.funnelMaxBuffer,
    wires: [ [ packer1NodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(packerTestNode(), {
    id: packer1NodeId,
    dstFormat: params.packer1Fmt,
    maxBuffer: params.packerMaxBuffer,
    wires: [ [ packer2NodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(packerTestNode(), {
    id: packer2NodeId,
    dstFormat: params.packer2Fmt,
    maxBuffer: params.packerMaxBuffer,
    x: 500.0,
    wires: [ [ encoderNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(encodeTestNode(), {
    id: encoderNodeId,
    dstFormat: params.encodeFmt,
    maxBuffer: params.encoderMaxBuffer,
    wires: [ [ decoderNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(decodeTestNode(), {
    id: decoderNodeId,
    maxBuffer: params.decoderMaxBuffer,
    dstFormat: params.decoderFmt,
    wires: [ [ spoutNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.spoutTestNode(), {
    id: spoutNodeId,
    timeout: params.spoutTimeout,
    x: 1100.0
  }));
  return testFlow;
}, (t, params, msgObj, onEnd) => {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, 'received end after expected number of pushes');
    onEnd();
  }
});

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

const TestUtil = require('dynamorse-test').TestUtil;

const packerTestNode = JSON.stringify({
  'type': 'packer',
  'z': TestUtil.testFlowId,
  'name': 'packer-test',
  'x': 300.0,
  'y': 100.0,
  'wires': [[]]
});

const encodeTestNode = JSON.stringify({
  'type': 'Cinecoder encoder',
  'z': TestUtil.testFlowId,
  'name': 'encode-test',
  'maxBuffer': 10,
  'wsPort': TestUtil.properties.wsPort,
  'x': 700.0,
  'y': 100.0,
  'wires': [[]]
});

const decodeTestNode = JSON.stringify({
  'type': 'Cinecoder decoder',
  'z': TestUtil.testFlowId,
  'name': 'decode-test',
  'x': 900.0,
  'y': 100.0,
  'wires': [[]]
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
  spoutTimeout: 0
}, (params) => {
  const testFlow = JSON.parse(TestUtil.testNodes.baseTestFlow);
  testFlow.nodes[0] = JSON.parse(TestUtil.testNodes.funnelGrainNode);
  testFlow.nodes[0].id = funnelNodeId;
  testFlow.nodes[0].numPushes = params.numPushes;
  testFlow.nodes[0].maxBuffer = params.funnelMaxBuffer;
  testFlow.nodes[0].wires[0][0] = packer1NodeId;

  testFlow.nodes[1] = JSON.parse(packerTestNode);
  testFlow.nodes[1].id = packer1NodeId;
  testFlow.nodes[1].dstFormat = params.packer1Fmt;
  testFlow.nodes[1].maxBuffer = params.packerMaxBuffer;
  testFlow.nodes[1].wires[0][0] = packer2NodeId;

  testFlow.nodes[2] = JSON.parse(packerTestNode);
  testFlow.nodes[2].id = packer2NodeId;
  testFlow.nodes[2].dstFormat = params.packer2Fmt;
  testFlow.nodes[2].maxBuffer = params.packerMaxBuffer;
  testFlow.nodes[2].x = 500.0;
  testFlow.nodes[2].wires[0][0] = encoderNodeId;

  testFlow.nodes[3] = JSON.parse(encodeTestNode);
  testFlow.nodes[3].id = encoderNodeId;
  testFlow.nodes[3].dstFormat = params.encodeFmt;
  testFlow.nodes[3].maxBuffer = params.encoderMaxBuffer;
  testFlow.nodes[3].wires[0][0] = decoderNodeId;

  testFlow.nodes[4] = JSON.parse(decodeTestNode);
  testFlow.nodes[4].id = decoderNodeId;
  testFlow.nodes[4].maxBuffer = params.decoderMaxBuffer;
  testFlow.nodes[4].wires[0][0] = spoutNodeId;

  testFlow.nodes[5] = JSON.parse(TestUtil.testNodes.spoutTestNode);
  testFlow.nodes[5].id = spoutNodeId;
  testFlow.nodes[5].timeout = params.spoutTimeout;
  testFlow.nodes[5].x = 1100.0;
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

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

const util = require('util');
const ValveCommon = require('./valveCommon.js').ValveCommon;
const cinecoder = require('cinecodernodejs');

module.exports = function (RED) {
  function CinecoderEncoder (config) {
    RED.nodes.createNode(this, config);
    ValveCommon.call(this, RED, config);

    const numInputs = 1;
    let dstBufLen = 0;

    const encoder = new cinecoder.Encoder(() => this.log('Cinecoder encoder exiting'));
    encoder.on('error', err => this.error('Cinecoder encoder error: ' + err));

    this.getProcessSources = cable => {
      // One video flow for processing, audio flows to pass through
      let selCable = cable.filter((c, i) => i < numInputs);
      if (Array.isArray(selCable[0].video)) {
        selCable[0].video = selCable[0].video.filter((f, i) => i < numInputs);
        selCable[0].video[0].newFlowID = true; // audio flows retain existing flowID, sourceID
      }
      return selCable;
    };
    this.findSrcTags = cable => {
      if (!Array.isArray(cable[0].video) && cable[0].video.length < 1) {
        return Promise.reject('Logical cable does not contain video');
      }
      return cable[0].video[0].tags;
    };

    this.makeDstTags = srcTags => {
      const dstTags = JSON.parse(JSON.stringify(srcTags));
      if ('video' === srcTags.format) {
        dstTags.packing = `${config.dstFormat}`;
        dstTags.encodingName = `${config.dstFormat}`;
      }
      return dstTags;
    };

    this.setInfo = (srcTags, dstTags, duration, logLevel) => {
      const srcVideoTags = srcTags.filter(t => 'video' === t.format)[0];
      const encodeParams = {};
      dstBufLen = encoder.setInfo(srcVideoTags, dstTags.video, duration, encodeParams, logLevel);
    };

    this.processGrain = (flowType, srcBufArray, cb) => {
      if ('video' === flowType) {
        const dstBuf = Buffer.alloc(dstBufLen);
        encoder.encode(srcBufArray[0], dstBuf, (err, result) => {
          cb(err, result);
        });
      } else {
        cb(null, srcBufArray[0]);
      }
    };

    this.quit = cb => {
      encoder.quit(() => cb());
    };

    this.closeValve = done => {
      this.close(done);
    };
  }

  util.inherits(CinecoderEncoder, ValveCommon);
  RED.nodes.registerType('Cinecoder encoder', CinecoderEncoder);
};

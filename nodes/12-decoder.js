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
  function CinecoderDecoder (config) {
    RED.nodes.createNode(this, config);
    ValveCommon.call(this, RED, config);
    
    const numInputs = 1;
    let dstBufLen = 0;

    const decoder = new cinecoder.Decoder(() => this.log('Cinecoder decoder exiting'));
    decoder.on('error', err => this.error('Cinecoder decoder error: ' + err));

    this.getProcessSources = cable => {
      // One video flow for processing, audio flows to pass through
      let selCable = cable.filter((c, i) => i < numInputs);
      if (Array.isArray(selCable[0].video)) {
        selCable[0].video = selCable[0].video.filter((f, i) => i < numInputs);
        selCable[0].video[0].newFlowID = true; // audio flows retain existing flowID, sourceID

        // patch the encodingName tag to the expected string
        const srcTags = selCable[0].video[0].tags;
        if ('H264' === srcTags.encodingName)
          srcTags.encodingName = 'AVCi';
        selCable[0].video[0].tags = srcTags;
      }
      return selCable;
    };

    this.makeDstTags = srcTags => {
      const dstTags = JSON.parse(JSON.stringify(srcTags));
      if ('video' === srcTags.format) {
        dstTags.packing = config.dstFormat;
        dstTags.sampling = 'YCbCr-4:2:2';

        var encoding = srcTags.encodingName;
        if ('AVCi50' === encoding)
          dstTags.width = srcTags.width * 3 / 4;
        dstTags.encodingName = 'raw';
      }
      return dstTags;
    };

    this.setInfo = (srcTags, dstTags, duration, logLevel) => {
      const srcVideoTags = srcTags.filter(t => 'video' === t.format)[0];
      dstBufLen = decoder.setInfo(srcVideoTags, dstTags.video, duration, logLevel);
    };

    this.processGrain = (flowType, srcBufArray, cb) => {
      if ('video' === flowType) {
        const dstBuf = Buffer.alloc(dstBufLen);
        decoder.decode(srcBufArray[0], dstBuf, (err, result) => {
          cb(err, result);
        });
      } else {
        cb(null, srcBufArray[0]);
      }
    };

    this.quit = cb => {
      decoder.quit(() => cb());
    };

    this.closeValve = () => {};
  }

  util.inherits(CinecoderDecoder, ValveCommon);
  RED.nodes.registerType('Cinecoder decoder', CinecoderDecoder);
};

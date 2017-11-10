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
    
    const decoder = new cinecoder.Decoder(() => this.log('Cinecoder decoder exiting'));
    decoder.on('error', err => this.error('Cinecoder decoder error: ' + err));

    this.findSrcTags = cable => {
      if (!Array.isArray(cable[0].video) && cable[0].video.length < 1) {
        return Promise.reject('Logical cable does not contain video');
      }

      const srcTags = cable[0].video[0].tags;
      if ('H264' === srcTags.encodingName)
        srcTags.encodingName = 'AVCi';

      return srcTags;
    };

    this.makeDstTags = srcTags => {
      const dstTags = JSON.parse(JSON.stringify(srcTags));
      dstTags.packing = 'UYVY10';
      dstTags.sampling = 'YCbCr-4:2:2';

      var encoding = srcTags.encodingName[0];
      if ('AVCi50' === encoding)
        dstTags.width = srcTags.width * 3 / 4;
      dstTags.encodingName = 'raw';
      return dstTags;
    };

    this.setInfo = (srcTags, dstTags, duration, logLevel) => {
      return decoder.setInfo(srcTags, dstTags, duration, logLevel);
    };

    this.processGrain = (x, dstBufLen, next, cb) => {
      const dstBuf = Buffer.alloc(dstBufLen);
      decoder.decode(x.buffers[0], dstBuf, (err, result) => {
        cb(err, result);
        next();
      });
    };

    this.quit = cb => {
      decoder.quit(() => cb());
    };

    this.closeValve = done => {
      this.close(done);
    };
  }

  util.inherits(CinecoderDecoder, ValveCommon);
  RED.nodes.registerType('Cinecoder decoder', CinecoderDecoder);
};

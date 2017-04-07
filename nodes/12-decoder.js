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

var util = require('util');
var redioactive = require('node-red-contrib-dynamorse-core').Redioactive;
var Grain = require('node-red-contrib-dynamorse-core').Grain;
var cinecoder = require('cinecodernodejs');

module.exports = function (RED) {
  function AVCiDecoder (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);
    this.srcFlow = null;
    var dstFlow = null;
    var dstBufLen = 0;

    if (!this.context().global.get('updated'))
      return this.log('Waiting for global context updated.');

    var decoder = new cinecoder.Decoder(function() {
      console.log('AVCi decoder exiting');
    });
    decoder.on('error', function(err) {
      console.log('AVCi decoder error: ' + err);
    });

    var node = this;
    var nodeAPI = this.context().global.get('nodeAPI');
    var ledger = this.context().global.get('ledger');
    var localName = config.name || `${config.type}-${config.id}`;
    var localDescription = config.description || `${config.type}-${config.id}`;
    var pipelinesID = config.device ?
      RED.nodes.getNode(config.device).nmos_id :
      this.context().global.get('pipelinesID');

    var source = new ledger.Source(null, null, localName, localDescription,
      ledger.formats.video, null, null, pipelinesID, null);

    function processGrain(x, dstBufLen, push, next) {
      var dstBuf = Buffer.alloc(dstBufLen);
      var numQueued = decoder.decode(x.buffers[0], dstBuf, (err, result) => {
        if (err) {
          push(err);
        } else if (result) {
          push(null, new Grain(result, x.ptpSync, x.ptpOrigin,
                               x.timecode, dstFlow.id, source.id, x.duration));
        }
        next();
      });
    }

    this.consume((err, x, push, next) => {
      if (err) {
        push(err);
        next();
      } else if (redioactive.isEnd(x)) {
        decoder.quit(() => {
          push(null, x);
        });
      } else if (Grain.isGrain(x)) {
        if (!this.srcFlow) {
          this.getNMOSFlow(x, (err, f) => {
            if (err) return push("Failed to resolve NMOS flow.");
            this.srcFlow = f;

            var dstTags = JSON.parse(JSON.stringify(this.srcFlow.tags));
            dstTags["packing"] = [ "UYVY10" ];
            dstTags["sampling"] = [ "YCbCr-4:2:2" ];

            var encoding = this.srcFlow.tags.encodingName[0];
            if ("AVCi50" === encoding) {
              var srcWidth = +this.srcFlow.tags["width"];
              dstTags["width"] = [ `${srcWidth * 3 / 4}` ];
            }
            dstTags["encodingName"] = [ "raw" ];

            var formattedDstTags = JSON.stringify(dstTags, null, 2);
            RED.comms.publish('debug', {
              format: "AVCi decoder output flow tags:",
              msg: formattedDstTags
            }, true);

            dstFlow = new ledger.Flow(null, null, localName, localDescription,
              ledger.formats.video, dstTags, source.id, null);

            nodeAPI.putResource(source).catch(err => {
              push(`Unable to register source: ${err}`);
            });
            nodeAPI.putResource(dstFlow).then(() => {
              dstBufLen = decoder.setInfo(this.srcFlow.tags, dstTags);
              processGrain(x, dstBufLen, push, next);
            }, err => {
              push(`Unable to register flow: ${err}`);
            });
          });
        } else {
          processGrain(x, dstBufLen, push, next);
        }
      } else {
        push(null, x);
        next();
      }
    });
    this.on('close', this.close);
  }
  util.inherits(AVCiDecoder, redioactive.Valve);
  RED.nodes.registerType("AVCi decoder", AVCiDecoder);
}

const GIFEncoder = require('gifencoder');
const Jimp = require('jimp');
const gifhelper = require('../gifhelper.js');

exports.createInfiniteGIF = (options) => {
  return new Promise((resolve, reject) => {
    gifhelper.getGifFromBuffer(options.buffer).then(inputGif => {
      let encoder = new GIFEncoder(inputGif.width, inputGif.height);

      gifhelper.getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
      gifhelper.setEncoderProperties(encoder);

      let scalesAmount = 5;
      let scaleDiff = 0.9; // Difference between each scale
      let scaleStep = 0.03 * 8 / options.value; // Scale shift between frames
      let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep);
      let frames = gifhelper.alignGif(inputGif.frames, scaleDiff / scaleStep);

      for (let i = 0; i < frames.length; i++) {
        encoder.setDelay(frames[i].delayCentisecs * 10);
        let frameData = getInfiniteShiftedFrameData(frames[i].bitmap, scales);
        encoder.addFrame(frameData.data);
        // Shift scales for next frame
        scales = shiftInfiniteScales(scales, scaleDiff, scaleStep);
      }

      encoder.finish();
    }).catch(reject);
  });
};

exports.createInfinitePNG = (options) => {
  return new Promise((resolve, reject) => {
    Jimp.read(options.buffer).then(image => {
      let {
        width,
        height,
        encoder
      } = gifhelper.preparePNGVariables(options, image.bitmap);
      image.resize(width, height);

      gifhelper.getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
      gifhelper.setEncoderProperties(encoder, options.value * 10);

      let scalesAmount = 5;
      let scaleDiff = 0.9; // Difference between each scale
      let scaleStep = 0.06; // Scale shift between frames
      let frames = scaleDiff / scaleStep - 1;
      let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep);

      for (let i = 0; i < frames; i++) {
        let frameData = getInfiniteShiftedFrameData(image.bitmap, scales);
        encoder.addFrame(frameData.data);
        // Shift scales for next frame
        scales = shiftInfiniteScales(scales, scaleDiff, scaleStep);
      }

      encoder.finish();
    }).catch(reject);
  });
};

function resetInfiniteScales(scalesAmount, scaleDiff, scaleStep) {
  let scales = [];
  for (let depth = 0; depth < scalesAmount; depth++) {
    scales.push((scalesAmount - depth - 1) * scaleDiff + scaleStep);
  }
  return scales;
}

function shiftInfiniteScales(scales, scaleDiff, scaleStep) {
  if (scales[0] >= scales.length * scaleDiff) {
    scales = resetInfiniteScales(scales.length, scaleDiff, scaleStep);
  } else {
    for (let depth = 0; depth < scales.length; depth++) {
      scales[depth] += scaleStep;
    }
  }
  return scales;
}

function getInfiniteShiftedFrameData(frameBitmap, scales) {
  let newFrame = new Jimp(frameBitmap.width, frameBitmap.height, 0x00);
  // Add appropriate frame with each depth scale
  for (let depth = 0; depth < scales.length; depth++) {
    let scaledFrame = new Jimp(frameBitmap);
    scaledFrame.scale(scales[depth]);
    let dx = (scaledFrame.bitmap.width - frameBitmap.width) / 2;
    let dy = (scaledFrame.bitmap.height - frameBitmap.height) / 2;
    // Blit frame properly with respect to the scale
    if (scales[depth] > 1) {
      newFrame.blit(scaledFrame, 0, 0, dx, dy, frameBitmap.width, frameBitmap.height);
    } else {
      newFrame.blit(scaledFrame, -dx, -dy);
    }
  }
  return newFrame.bitmap;
}
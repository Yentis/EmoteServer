const GIFEncoder = require('gifencoder');
const request = require('request');
const {
  GifUtil
} = require('gifwrap');
const toStream = require('buffer-to-stream');

exports.getGifFromBuffer = (data) => {
  return new Promise((resolve, reject) => {
    this.getBuffer(data).then(buffer => {
      GifUtil.read(buffer).then(inputGif => {
        resolve(inputGif);
      }).catch(error => reject(error));
    }).catch(error => reject(error));
  });
}

exports.alignGif = (frames, interval) => {
  // Duplicate frames until interval is reached
  let alignedFrames = GifUtil.cloneFrames(frames);
  while (alignedFrames.length < interval) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames));
  }

  let framesToDelete = alignedFrames.length % interval;
  /*
    Removing more than 20% of frames makes it look sucky => add copies until it's below 20%
    Worst case: interval = (frames.length / 2) + 1 e.g. interval 17 with 32 frames
    then framesToDelete = 15/32 (46.9%) -> 13/64 (20.3%) -> 11/96 (11.4%)
  */
  while (framesToDelete / alignedFrames.length > 0.2) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames));
    framesToDelete = alignedFrames.length % interval;
  }

  let amountCopies = alignedFrames.length / frames.length;
  let currentCopy = 0;

  for (let i = 0; i < framesToDelete; i++) {
    let frameToDelete = Math.floor(Math.random() * frames.length - 1) + 1;
    alignedFrames.splice(frameToDelete + currentCopy * frames.length, 1);
    // Keep shifting copy so each copy loses about the same amount of frames
    currentCopy = (currentCopy + 1) % amountCopies;
  }

  return alignedFrames;
}

exports.setFrameProperties = (frame, options) => {
  frame.interlaced = false;
  if (options !== undefined) {
    for (let [key, value] of Object.entries(options)) {
      frame[key] = value;
    }
  }
}

exports.getBuffer = (data) => {
  return new Promise((resolve, reject) => {
    let buffers = [];
    let readStream;

    if (Buffer.isBuffer(data)) {
      readStream = toStream(data);
    } else if (typeof (data) === 'string') {
      readStream = request(data, (err) => {
        if (err) {
          reject(err);
        }
      });
    } else {
      readStream = data;
    }

    readStream.on('data', chunk => {
      buffers.push(chunk);
    }).on('end', () => {
      resolve(Buffer.concat(buffers));
    }).on('error', error => {
      reject(error);
    });
  });
}

exports.setEncoderProperties = (encoder, delay) => {
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(5);
  if (delay) {
    encoder.setDelay(delay);
  }
  encoder.setTransparent(0x00000000);
}

exports.preparePNGVariables = (options, image) => {
  const {
    widthModifier,
    heightModifier
  } = getSizeFromOptions(options);
  // Flooring to elude rounding errors
  const width = Math.floor(widthModifier * image.width);
  const height = Math.floor(heightModifier * image.height);

  return {
    width,
    height,
    encoder: new GIFEncoder(width, height)
  };
}

const spin = require('./modifiers/spin.js');
exports.spinEmote = (options) => {
  if (options.type === 'gif') {
    return spin.createSpinningGIF(options);
  } else {
    return spin.createSpinningPNG(options);
  }
}

const shake = require('./modifiers/shake.js');
exports.shakeEmote = (options) => {
  if (options.type === 'gif') {
    return shake.createShakingGIF(options);
  } else {
    return shake.createShakingPNG(options);
  }
}

const rainbow = require('./modifiers/rainbow.js');
exports.rainbowEmote = (options) => {
  if (options.type === 'gif') {
    return rainbow.createRainbowGIF(options);
  } else {
    return rainbow.createRainbowPNG(options);
  }
}

const wiggle = require('./modifiers/wiggle.js');
exports.wiggleEmote = (options) => {
  if (options.type === 'gif') {
    return wiggle.createWigglingGIF(options);
  } else {
    return wiggle.createWigglingPNG(options);
  }
}

const infinite = require('./modifiers/infinite.js');
exports.infiniteEmote = (options) => {
  if (options.type === 'gif') {
    return infinite.createInfiniteGIF(options);
  } else {
    return infinite.createInfinitePNG(options);
  }
}

const slide = require('./modifiers/slide.js');
exports.slideEmote = (options) => {
  if (options.type === 'gif') {
    return slide.createSlidingGIF(options);
  } else {
    return slide.createSlidingPNG(options);
  }
}

function getSizeFromOptions(options) {
  let widthModifier = 1;
  let heightModifier = 1;

  if (!options.isResized) {
    let size = options.size;

    if ((typeof size) === 'string' && size.indexOf('x') !== -1) {
      size = size.split('x');
      widthModifier = size[0];
      heightModifier = size[1];
    } else {
      widthModifier = size;
      heightModifier = size;
    }
  }

  return {
    widthModifier,
    heightModifier
  };
}
const GIFEncoder = require('gifencoder');
const {
  createCanvas,
  loadImage
} = require('canvas');
const request = require('request');
const Jimp = require('jimp');
const {
  GifUtil,
  GifCodec,
  GifFrame,
} = require('gifwrap');
const toStream = require('buffer-to-stream');

function getGifFromBuffer(data) {
  return new Promise((resolve, reject) => {
    getBuffer(data).then(buffer => {
      GifUtil.read(buffer).then(inputGif => {
        resolve(inputGif);
      }).catch(error => reject(error));
    }).catch(error => reject(error));
  });
}

exports.createRotatingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {
      let { degrees, interval, max, margin } = prepareRotatingVariables(
        inputGif.frames[0].delayCentisecs, // assuming all frames have the same delay
        100, // 100cs per rotation -> 1 rotation per second
        options.name === 'spinrev',
        inputGif.width,
        inputGif.height
      );
      let frames = alignGif(inputGif.frames, interval);

      for (let i = 0; i < frames.length; i++) {
        let adjustedImg = new Jimp(max, max);
        if (inputGif.width > inputGif.height) {
          adjustedImg.blit(new Jimp(frames[i].bitmap), 0, margin);
        } else {
          adjustedImg.blit(new Jimp(frames[i].bitmap), margin, 0);
        }
        adjustedImg.rotate((i * degrees) % 360, false);
        setFrameProperties(frames[i], { bitmap: adjustedImg.bitmap });
      }
      let codec = new GifCodec();
      codec.encodeGif(frames).then(resultGif => {
        resolve(resultGif.buffer);
      });
    }).catch(error => reject(error));
  });
};

exports.createShakingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {

      const interval = 4;
      let frames = alignGif(inputGif.frames, interval);
      let curFrame = 0;
      for (let i = 0; i < (frames.length / interval); i++) {
        for (let j = 0; j < interval; j++) {
          let frame = frames[curFrame];
          setFrameProperties(frame, { delayCentisecs: Math.max(2, options.value) });
          let tempFrame = new GifFrame(frame);
          tempFrame.fillRGBA(0x00);
          switch (j) {
            case 0:
              frame.blit(tempFrame, 0, 0, 1, 1, inputGif.width - 1, inputGif.height - 1);
              break;
            case 1:
              frame.blit(tempFrame, 0, 1, 1, 0, inputGif.width - 1, inputGif.height - 1);
              break;
            case 2:
              frame.blit(tempFrame, 1, 1, 0, 0, inputGif.width - 1, inputGif.height - 1);
              break;
            case 3:
              frame.blit(tempFrame, 1, 0, 0, 1, inputGif.width - 1, inputGif.height - 1);
              break;
          }
          frames[curFrame] = new GifFrame(tempFrame);
          curFrame++;
        }
      }
      let codec = new GifCodec();
      codec.encodeGif(frames).then(resultGif => {
        resolve(resultGif.buffer);
      });
    }).catch(error => reject(error));
  });
};

exports.createColorShiftingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {

      let interval = 32;
      let frames = alignGif(inputGif.frames, interval);
      let randomBlack = Math.random();
      let randomWhite = Math.random();

      for (let i = 0; i < frames.length; i++) {
        let frame = frames[i];
        setFrameProperties(frame);
        shiftColors(frame.bitmap, (i % interval) / interval, randomBlack, randomWhite);
      }
      let codec = new GifCodec();
      codec.encodeGif(frames).then(resultGif => {
        resolve(resultGif.buffer);
      });
    }).catch(error => reject(error));
  });
};

exports.createWigglingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {

      let imgWidth = inputGif.width;
      let width = imgWidth + 2 * Math.floor(imgWidth * options.value * 0.1 / 15);
      let margin = width - imgWidth;

      let { shiftSize, interval, stripeHeight, shift, left } = prepareWiggleVariables(margin, inputGif.height);
      let frames = alignGif(inputGif.frames, interval);

      for (let i = 0; i < frames.length; i++) {
        let frameData = getWiggledFrameData(
          new Jimp(frames[i].bitmap),
          shift,
          left,
          { stripeHeight, shiftSize, width, margin },
        );
        setFrameProperties(frames[i], { bitmap: frameData });
        // Set initial wiggle offset for next frame
        [shift, left] = shiftWiggleStep(shift, left, margin, shiftSize);
      }
      let codec = new GifCodec();
      codec.encodeGif(frames).then(resultGif => {
        resolve(resultGif.buffer);
      });
    }).catch(error => reject(error));
  });
};

exports.createInfiniteGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {
      let encoder = new GIFEncoder(inputGif.width, inputGif.height);

      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder);

      let scalesAmount = 5;
      let scaleDiff = 0.9;   // Difference between each scale
      let scaleStep = 0.03;  // Scale shift between frames
      let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep);
      let frames = alignGif(inputGif.frames, scaleDiff / scaleStep);

      for (let i = 0; i < frames.length; i++) {
        encoder.setDelay(frames[i].delayCentisecs * 10);
        let frameData = getInfiniteShiftedFrameData(frames[i].bitmap, scales);
        encoder.addFrame(frameData.data);
        // Shift scales for next frame
        scales = shiftInfiniteScales(scales, scaleDiff, scaleStep);
      }

      encoder.finish();
    }).catch(error => reject(error));
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

exports.createSlidingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {
      let width = inputGif.width;
      let { interval, shift, shiftSize } = prepareSlidingVariables(width);
      let frames = alignGif(inputGif.frames, interval);
      
      for (let i = 0; i < frames.length; i++) {
        let frameData = getShiftedFrameData(new Jimp(frames[i].bitmap), shift);
        setFrameProperties(frames[i], { bitmap: frameData });
        shift = (shift + options.value * shiftSize) % width;
      }
      let codec = new GifCodec();
      codec.encodeGif(frames).then(resultGif => {
        resolve(resultGif.buffer);
      });
    }).catch(error => reject(error));
  });
};

function setFrameProperties(frame, options) {
  frame.interlaced = false;
  if (options !== undefined) {
    for (let [key, value] of Object.entries(options)) {
      frame[key] = value;
    }
  }
}

exports.createRotatingPNG = function(options) {
  return new Promise((resolve, reject) => {
    Jimp.read(options.buffer).then(image => {

      let { width, height } = preparePNGVariables(options, image.bitmap);
      let { degrees, interval, max, margin } = prepareRotatingVariables(
        options.value, // delay
        100, // 100cs per rotation -> 1 rotation per second
        options.name === 'spinrev',
        width,
        height
      );
      let encoder = new GIFEncoder(max, max);
      image.resize(width, height);

      let resizedImage = new Jimp(max, max);
      image = width > height
        ? resizedImage.blit(image, 0, margin)
        : resizedImage.blit(image, margin, 0);

      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, options.value * 10);

      for (let i = 0; i < interval; i++) {
        let rotatedImage = new Jimp(resizedImage.bitmap);
        rotatedImage.rotate(i * degrees, false);
        encoder.addFrame(rotatedImage.bitmap.data);
      }
      encoder.finish();
    }).catch(error => reject(error));
  });
};

function prepareRotatingVariables(delay, centisecsPerRotation, reverse, width, height) {
  let degrees = 360 * delay / centisecsPerRotation;
  let interval = Math.floor(360 / degrees);
  degrees *= reverse ? 1 : -1;
  let margin = (width - height) / 2;
  if (height > width) margin *= -1;
  return {
    degrees,
    interval,
    max: Math.max(width, height),
    margin,
  };
}

exports.createShakingPNG = function(options) {
  return new Promise((resolve, reject) => {
    loadImage(options.buffer).then(image => {
      let {width, height, encoder} = preparePNGVariables(options, image);

      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, options.value * 10);

      let canvas = createCanvas(width, height);

      for (let i = 0; i < 4; i++) {
        ctx = clearContext(canvas);
        switch (i) {
          case 0: ctx.translate(width - 1, height - 1); break;
          case 1: ctx.translate(width - 1, height + 1); break;
          case 2: ctx.translate(width + 1, height + 1); break;
          case 3: ctx.translate(width + 1, height - 1); break;
        }
        ctx.drawImage(image, -width, -height, width, height);
        encoder.addFrame(ctx);
      }

      encoder.finish();
    }).catch(error => reject(error));
  });
};

exports.createColorShiftingPNG = function(options) {
  return new Promise((resolve, reject) => {
    loadImage(options.buffer).then(image => {
      let {width, height, encoder} = preparePNGVariables(options, image);
      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, options.value * 10);
      let ctx = prepareContext(image, width, height);

      let amountFrames = 32;  // arbitrary
      let interval = 1 / amountFrames; // hue shift per step
      let randomBlack = Math.random();
      let randomWhite = Math.random();
      for (let i = 0; i < amountFrames; i++) {
        let imgData = ctx.getImageData(0, 0, width, height);
        shiftColors(imgData, interval, randomBlack, randomWhite);

        ctx.putImageData(imgData, 0, 0);
        encoder.addFrame(ctx);
      }

      encoder.finish();
    }).catch(error => reject(error));
  });
};

function shiftColors(imgData, interval, randomBlack, randomWhite) {
  for (let i = 0; i < imgData.data.length; i += 4) {
    if (imgData.data[i + 3] > 0) {  // only recolor if non-transparent
      let colors = shiftColor(imgData.data, i, interval, randomBlack, randomWhite);

      while (colors[0] > 1) colors[0]--;
      colors = hsl2rgb(colors[0], colors[1], colors[2]);
      imgData.data.set(colors, i);
    }
  }
}

function shiftColor(imgData, index, shiftAmount, randomBlack, randomWhite) {
  let initialColors = [imgData[index], imgData[index + 1], imgData[index + 2]];
  let whiteThreshold = 30;
  let blackThreshold = 220;

  let colors;
  if (initialColors[0] <= whiteThreshold && initialColors[1] <= whiteThreshold && initialColors[2] <= whiteThreshold) {
    colors = [randomWhite, 0.5, 0.2];
  } else if (initialColors[0] >= blackThreshold && initialColors[1] >= blackThreshold && initialColors[2] >= blackThreshold) {
    colors = [randomBlack, 0.5, 0.8];
  } else {
    colors = rgb2hsl(initialColors[0], initialColors[1], initialColors[2]);
  }

  colors[0] += shiftAmount;
  return colors;
}

exports.createWigglingPNG = function(options) {
  return new Promise((resolve, reject) => {
    Jimp.read(options.buffer).then(image => {
      let { width: imgWidth, height } = preparePNGVariables(options, image.bitmap);
      image.resize(imgWidth, height);

      let width = imgWidth + 2 * Math.floor(imgWidth * options.value * 0.1 / 15); // ~6.6% of width is wiggle room for both sides
      let margin = width - imgWidth;

      let encoder = new GIFEncoder(width, height);
      let { shiftSize, interval, stripeHeight, shift, left } = prepareWiggleVariables(margin, height);

      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, 80);

      for (let i = 0; i < interval; i++) {
        // Wiggle frame
        let frameData = getWiggledFrameData(image, shift, left, { stripeHeight, shiftSize, width, margin });
        encoder.addFrame(frameData.data);
        // Set initial wiggle offset for next frame
        [shift, left] = shiftWiggleStep(shift, left, margin, shiftSize);
      }
      encoder.finish();
    }).catch(error => reject(error));
  });
};

function shiftWiggleStep(shift, left, margin, shiftSize) {
  if (left) {
    shift -= shiftSize;
    if (shift < -shiftSize) left = false;
  } else {
    shift += shiftSize;
    if (shift > margin + shiftSize) left = true;
  }
  return [shift, left];
}

function prepareWiggleVariables(margin, height) {
  let shiftSize = Math.max(1, margin / 6);
  let interval = 2 * (margin / shiftSize + 4);
  let stripeHeight = Math.max(1, Math.floor(height / 32));
  let shift = margin / 2; // Initial offset of wiggle
  let left = true;        // true -> go to left
  return { shiftSize, interval, stripeHeight, shift, left };
}

function getWiggledFrameData(oldFrame, shift, left, options) {
  let newFrame = new Jimp(options.width, oldFrame.bitmap.height, 0x00);
  // Wiggle each stripe
  for (let stripe = 0; stripe < oldFrame.bitmap.height; stripe += options.stripeHeight) {
    newFrame.blit(oldFrame, shift, stripe, 0, stripe, oldFrame.bitmap.width, options.stripeHeight);
    [shift, left] = shiftWiggleStep(shift, left, options.margin, options.shiftSize);
  }
  return newFrame.bitmap;
}

exports.createInfinitePNG = function(options) {
  return new Promise((resolve, reject) => {
    Jimp.read(options.buffer).then(image => {
      let { width, height, encoder} = preparePNGVariables(options, image.bitmap);
      image.resize(width, height);

      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, options.value * 10);

      let scalesAmount = 5;
      let scaleDiff = 0.9;   // Difference between each scale
      let scaleStep = 0.06;  // Scale shift between frames
      let frames = scaleDiff / scaleStep - 1;
      let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep);

      for (let i = 0; i < frames; i++) {
        let frameData = getInfiniteShiftedFrameData(image.bitmap, scales);
        encoder.addFrame(frameData.data);
        // Shift scales for next frame
        scales = shiftInfiniteScales(scales, scaleDiff, scaleStep);
      }

      encoder.finish();
    }).catch(error => reject(error));
  });
};

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

exports.createSlidingPNG = function(options) {
  return new Promise((resolve, reject) => {
    Jimp.read(options.buffer).then(image => {
      let { width, height, encoder } = preparePNGVariables(options, image.bitmap);
      let { interval, shift, shiftSize } = prepareSlidingVariables(width);
      image.resize(width, height);
      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, 80);
      for (let i = 0; i < interval; i++) {
        let frameData = getShiftedFrameData(image, Math.floor(shift));
        encoder.addFrame(frameData.data);
        shift = (shift + options.value * shiftSize) % width;
      }
      encoder.finish();
    }).catch(error => reject(error));
  });
};

function prepareSlidingVariables(width) {
  let interval = 16;
  return {
    interval,
    shift: 0,
    shiftSize: width / interval,
  };
}

function getShiftedFrameData(oldFrame, shift) {
  let width = oldFrame.bitmap.width;
  let height = oldFrame.bitmap.height;
  let newFrame = new Jimp(width, height, 0x00);
  newFrame.blit(oldFrame, shift, 0, 0, 0, width - shift, height);
  newFrame.blit(oldFrame, 0, 0, width - shift, 0, shift, height);
  return newFrame.bitmap;
}

// r, g, b in [0, 255] ~ h, s, l in [0, 1]
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [ h, s, l ];
}

function hue2rgb(p, q, t) {
    if (t < 0) t++;
    else if (t > 1) t--;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}

// h, s, l in [0, 1] ~ r, g, b in [0, 255]
function hsl2rgb(h, s, l) {
    let r, g, b, q, p;
    if (s === 0) {
        r = g = b = l;
    } else {
        q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [ r * 255, g * 255, b * 255 ];
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

  return {widthModifier, heightModifier};
}

function preparePNGVariables(options, image) {
  const {widthModifier, heightModifier} = getSizeFromOptions(options);
  // Flooring to elude rounding errors
  const width = Math.floor(widthModifier * image.width);
  const height = Math.floor(heightModifier * image.height);

  return {
    width,
    height,
    encoder: new GIFEncoder(width, height)
  };
}

function setEncoderProperties(encoder, delay) {
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(5);
  if (delay) {
    encoder.setDelay(delay);
  }
  encoder.setTransparent(0x00000000);
}

function prepareContext(image, width, height) {
  let canvas = createCanvas(width, height);
  let ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  
  return ctx;
}

function clearContext(canvas) {
  let ctx = canvas.getContext('2d');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return ctx;
}

function getBuffer(data) {
  return new Promise((resolve, reject) => {
    let buffers = [];
    let readStream;

    if (Buffer.isBuffer(data)) {
      readStream = toStream(data);
    } else if (typeof(data) === 'string') {
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

function alignGif(frames, interval) {
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

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
  BitmapImage,
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

exports.rotateGIF = function(data, degrees) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(data).then(inputGif => {
      staticRotateGIF(-degrees, inputGif, frames => {
          let codec = new GifCodec();
          codec.encodeGif(frames).then(resultGif => {
            resolve(resultGif.buffer);
          }).catch(error => reject(error));
        });
    }).catch(error => reject(error));
  });
};

function staticRotateGIF(degrees, inputGif, callback) {
  let doneCount = 0;

  inputGif.frames.forEach(frame => {
    setFrameProperties(frame);
    const jShared = new Jimp(1, 1, 0);
    jShared.bitmap = frame.bitmap;
    jShared.rotate(degrees, false, () => {
      doneCount++;
      if (doneCount >= inputGif.frames.length) {
        callback(inputGif.frames);
      }
    });
  });
}

exports.createRotatingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {
      options.degrees = options.name === 'spinrev' ? 30 : -30;
      addRotateFramesGIF(inputGif, options, frames => {
        let codec = new GifCodec();
        codec.encodeGif(frames).then(resultGif => {
          resolve(resultGif.buffer);
        });
      });
    }).catch(error => reject(error));
  });
};

function addRotateFramesGIF(inputGif, options, callback) {
  const interval = 12;
  let frames = alignGif(inputGif.frames, interval);
  let doneCount = 0;
  let curFrame = 0;
  for (let i = 0; i < (frames.length / interval); i++) {
    for (let j = 0; j < interval; j++) {
      let frame = frames[curFrame];
      setFrameProperties(frame, { delayCentisecs: Math.max(2, options.value) });
      const jShared = new Jimp(1, 1, 0);
      jShared.bitmap = frame.bitmap;
      jShared.rotate(options.degrees * j, false, () => {
        doneCount++;
        if (doneCount >= frames.length) {
          callback(frames);
        }
      });
      curFrame++;
    }
  }
}

exports.createShakingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {
      addShakingFramesGIF(inputGif, options, frames => {
        let codec = new GifCodec();
        codec.encodeGif(frames).then(resultGif => {
          resolve(resultGif.buffer);
        });
      });
    }).catch(error => reject(error));
  });
};

function addShakingFramesGIF(inputGif, options, callback) {
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
  callback(frames);
}

exports.createColorShiftingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {
      addColorShiftingFramesGIF(inputGif, options, frames => {
        let codec = new GifCodec();
        codec.encodeGif(frames).then(resultGif => {
          resolve(resultGif.buffer);
        });
      });
    }).catch(error => reject(error));
  });
};

function addColorShiftingFramesGIF(inputGif, options, callback) {
  let interval = 32; // go over "each" color every 32 frames
  let frames = alignGif(inputGif.frames, interval);
  let randomBlack = Math.random();
  let randomWhite = Math.random();

  for (let i = 0; i < frames.length; i++) {
    let frame = frames[i];
    setFrameProperties(frame);
    shiftColors(frame.bitmap, (i % interval) / interval, randomBlack, randomWhite);
  }
  callback(frames);
}

exports.createWigglingGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {
      addWigglingFramesGIF(inputGif, options, frames => {
        let codec = new GifCodec();
        codec.encodeGif(frames).then(resultGif => {
          resolve(resultGif.buffer);
        });
      });
    }).catch(error => reject(error));
  });
}

function addWigglingFramesGIF(inputGif, options, callback) {
  let imgWidth = inputGif.frames[0].bitmap.width;
  options.width = imgWidth + 2 * Math.floor(imgWidth / 15); // ~6.6% of width is wiggle room for both sides
  options.height = inputGif.frames[0].bitmap.height;
  options.margin = options.width - imgWidth;

  let {shiftSize, interval, stripeHeight, shift, left} = prepareWiggleVariables(options.margin);
  let frames = alignGif(inputGif.frames, interval);

  for (let i = 0; i < frames.length; i++) {
    let frameData = getWiggledFrameData(new Jimp(frames[i].bitmap), shift, left, stripeHeight, shiftSize, options);
    setFrameProperties(frames[i], { bitmap: frameData });
    // Set initial wiggle offset for next frame
    [shift, left] = shiftStep(shift, left, options.margin, shiftSize);
  }
  callback(frames);
}

exports.createInfiniteGIF = function(options) {
  return new Promise((resolve, reject) => {
    getGifFromBuffer(options.buffer).then(inputGif => {

      let scalesAmount = 5;
      let scaleDiff = 0.9;   // Difference between each scale
      let scaleStep = 0.03;  // Scale shift between frames
      let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep);
      let frames = alignGif(inputGif.frames, scaleDiff / scaleStep);

      for (let i = 0; i < frames.length; i++) {
        let frameData = getInfiniteShiftedFrameData(frames[i].bitmap, scales, frames[i].bitmap.width, frames[i].bitmap.height);
        setFrameProperties(frames[i], { bitmap: frameData });
        // Shift scales for next frame
        scales = shiftInfiniteScales(scales, scaleDiff, scaleStep);
      }
      let codec = new GifCodec();
      codec.encodeGif(frames).then(resultGif => {
        resolve(resultGif.buffer);
      });
    }).catch(error => reject(error));
  });
}

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
    loadImage(options.buffer).then(image => {
      let {width, height} = preparePNGVariables(options, image);
      let max = Math.max(width, height);
      let encoder = new GIFEncoder(max, max);

      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, options.value * 10)
      
      let canvas = createCanvas(max, max);
      let ctx = canvas.getContext('2d');
      if (height < width) {
        ctx.drawImage(image, 0, (width - height) / 2, width, height);
      } else if (width < height) {
        ctx.drawImage(image, (height - width) / 2, 0, width, height);
      } else { // height == width
        ctx.drawImage(image, 0, 0, width, height);
      }

      addRotateFramesPNG({
        image: image,
        canvas: canvas,
        encoder: encoder,
        width: width,
        height: height,
        name: options.name
      });

      encoder.finish();
    }).catch(error => reject(error));
  });
};

function addRotateFramesPNG(options) {
  if (options.name === 'spinrev') {
    for (let i = 0; i > -360; i -= 30) {
      addRotateFramePNG(options, i);
    }
  } else {
    for (let i = 0; i < 360; i += 30) {
      addRotateFramePNG(options, i);
    }
  }
}

function addRotateFramePNG(options, i) {
  let canvas = options.canvas;
  let ctx = clearContext(canvas);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(i * Math.PI / 180);
  ctx.drawImage(options.image, -options.width/2, -options.height/2, options.width, options.height);
  options.encoder.addFrame(ctx);
}

exports.createShakingPNG = function(options) {
  return new Promise((resolve, reject) => {
    loadImage(options.buffer).then(image => {
      let {width, height, encoder} = preparePNGVariables(options, image);

      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, options.value * 10);
      prepareContext(image, width, height);

      let canvas = createCanvas(width, height);
      addShakingFramesPNG({
        canvas: canvas,
        image: image,
        width: width,
        height: height,
        encoder: encoder
      });

      encoder.finish();
    }).catch(error => reject(error));
  });
};

function addShakingFramesPNG(options) {
  let canvas = options.canvas;
  let ctx = clearContext(canvas);

  for (let i = 0; i < 4; i++) {
    ctx = clearContext(canvas);
    switch (i) {
      case 0:
        ctx.translate(canvas.width - 1, canvas.height - 1);
        break;
      case 1:
        ctx.translate(canvas.width - 1, canvas.height + 1);
        break;
      case 2:
        ctx.translate(canvas.width + 1, canvas.height + 1);
        break;
      case 3:
        ctx.translate(canvas.width + 1, canvas.height - 1);
        break;
    }
    ctx.drawImage(options.image, -options.width, -options.height, options.width, options.height);
    options.encoder.addFrame(ctx);
  }
}

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
        shiftColors(
          imgData,
          interval,
          randomBlack,
          randomWhite
        );

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
      let { width: imgWidth, height} = preparePNGVariables(options, image.bitmap);
      image.resize(imgWidth, height);

      options.height = height;
      options.width = imgWidth + 2 * Math.floor(imgWidth / 15); // ~6.6% of width is wiggle room for both sides
      options.margin = options.width - imgWidth;

      let encoder = new GIFEncoder(options.width, height);
      let {shiftSize, interval, stripeHeight, shift, left} = prepareWiggleVariables(options.margin);

      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));
      setEncoderProperties(encoder, options.value * 5);

      for (let i = 0; i < interval; i++) {
        // Wiggle frame
        let frameData = getWiggledFrameData(image, shift, left, stripeHeight, shiftSize, options);
        encoder.addFrame(frameData.data);
        // Set initial wiggle offset for next frame
        [shift, left] = shiftStep(shift, left, options.margin, shiftSize);
      }
      encoder.finish();
    }).catch(error => reject(error));
  });
};

function prepareWiggleVariables(margin) {
  let shiftSize = Math.max(1, Math.floor(margin / 6));
  let interval = 2 * (margin / shiftSize + 4);
  let stripeHeight = 2 * shiftSize;
  let shift = margin / 2; // Initial offset of wiggle
  let left = true;        // true -> go to left
  return { shiftSize, interval, stripeHeight, shift, left };
}

function getWiggledFrameData(oldFrame, shift, left, stripeHeight, shiftSize, options) {
  let newFrame = new Jimp(options.width, options.height, 0x00);
  for (let stripe = 0; stripe < options.height; stripe += stripeHeight) {
    for (let line = 0; line < stripeHeight; line++) {
      newFrame.blit(oldFrame, shift, stripe + line, 0, stripe + line, oldFrame.bitmap.width, 1);
    }
    [shift, left] = shiftStep(shift, left, options.margin, shiftSize);
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
        let frameData = getInfiniteShiftedFrameData(image.bitmap, scales, width, height);
        encoder.addFrame(frameData.data);
        // Shift scales for next frame
        scales = shiftInfiniteScales(scales, scaleDiff, scaleStep);
      }
      encoder.finish();
    }).catch(error => reject(error));
  });
};

function getInfiniteShiftedFrameData(frameBitmap, scales, width, height) {
  let newFrame = new Jimp(width, height, 0x00);
  // Add appropriate frame with each depth scale
  for (let depth = 0; depth < scales.length; depth++) {
    let scaledFrame = new Jimp(frameBitmap);
    scaledFrame.scale(scales[depth]);
    let dx = (scaledFrame.bitmap.width - width) / 2;
    let dy = (scaledFrame.bitmap.height - height) / 2;
    let imgData, offset;
    // Blit frame properly with respect to the scale
    if (scales[depth] > 1) {
      newFrame.blit(scaledFrame, 0, 0, dx, dy, width, height);
    } else {
      newFrame.blit(scaledFrame, -dx, -dy);
    }
  }
  // Jimp's blitting adds too much color info, requantize
  GifUtil.quantizeDekker(newFrame, 256);
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

function shiftStep(shift, left, margin, shiftSize) {
  if (left) {
    shift -= shiftSize;
    if (shift < -shiftSize) left = false;
  } else {
    shift += shiftSize;
    if (shift > margin + shiftSize) left = true;
  }
  return [shift, left];
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
  const width = widthModifier * image.width;
  const height = heightModifier * image.height;

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
  encoder.setDelay(delay);
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
  let alignedFrames = GifUtil.cloneFrames(frames);
  while (alignedFrames.length < interval) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames));
  }
  let amountCopies = alignedFrames.length / frames.length;

  let framesToDelete = alignedFrames.length % interval;
  let currentCopy = 0;

  for (let i = 0; i < framesToDelete; i++) {
    let frameToDelete = Math.floor(Math.random() * frames.length - 1) + 1;
    alignedFrames.splice(frameToDelete + currentCopy * frames.length, 1);
    // Keep shifting copy so each copy loses about the same amount of frames
    currentCopy = (currentCopy + 1) % amountCopies;
  }

  return alignedFrames;
}

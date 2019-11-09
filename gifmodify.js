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
  GifFrame
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
      setFrameProperties(frame);
      frame.delayCentisecs = Math.max(2, options.value);
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
      setFrameProperties(frame);
      frame.delayCentisecs = Math.max(2, options.value);
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
  let frames = inputGif.frames;
  while (frames.length < 16) {  // increase gif length to not skip too many colors
    frames = frames.concat(GifUtil.cloneFrames(frames));
  }
  let interval = Math.floor(frames.length / 32) + 1; // go over "each" color every up to 32 frames
  let randomBlack = Math.random();
  let randomWhite = Math.random();

  for (let i = 0; i < frames.length; i++) {
    let frame = frames[i];
    setFrameProperties(frame);
    shiftColors(frame.bitmap, interval * i / frames.length, randomBlack, randomWhite);
  }
  callback(frames);
}

function setFrameProperties(frame) {
  frame.interlaced = false;
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
      setEncoderProperties(encoder, options.value * 5);
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

      for (let k = 0; k < 3; k++) {
        imgData.data[i + k] = colors[k];
      }
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

function preparePNGVariables(options, image) {
  const size = options.isResized ? 1 : options.size;
  const width = size * image.width;
  const height = size * image.height;

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
  while (frames.length < interval) {
    let startLength = frames.length;
    for (let i = 0; i < startLength; i++) {
      let frame = new GifFrame(frames[i]);
      frames.push(frame);
    }
  }

  let framesToDelete = frames.length % interval;

  for (let i = 0; i < framesToDelete; i++) {
    let frameToDelete = Math.floor(Math.random() * frames.length - 1) + 1;
    frames.splice(frameToDelete, 1);
  }

  return frames;
}
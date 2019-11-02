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

function setFrameProperties(frame, options) {
  frame.interlaced = false;
}

exports.createRotatingPNG = function(options) {
  return new Promise((resolve, reject) => {
    loadImage(options.buffer).then(image => {
      let size = options.isResized ? 1 : options.size;
      let width = size * image.width;
      let height = size * image.height;
      let max = Math.max(width, height);
      let encoder = new GIFEncoder(max, max);
      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));

      encoder.start();
      encoder.setRepeat(0);
      encoder.setQuality(5);
      encoder.setDelay(options.value * 10);
      encoder.setTransparent(0x00000000);
      
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
      let size = options.isResized ? 1 : options.size;
      let width = size * image.width;
      let height = size * image.height;
      let encoder = new GIFEncoder(width, height);
      getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer));

      encoder.start();
      encoder.setRepeat(0);
      encoder.setQuality(5);
      encoder.setDelay(options.value * 10);
      encoder.setTransparent(0x00000000);

      let canvas = createCanvas(width, height);
      let ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);
      encoder.addFrame(ctx);

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
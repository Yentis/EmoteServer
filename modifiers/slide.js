const GIFEncoder = require('gifencoder');
const Jimp = require('jimp');
const gifhelper = require('../gifhelper.js');

exports.createSlidingGIF = (options) => {
    return new Promise((resolve, reject) => {
        gifhelper.getGifFromBuffer(options.buffer).then(inputGif => {
            let encoder = new GIFEncoder(inputGif.width, inputGif.height);
            gifhelper.getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
            gifhelper.setEncoderProperties(encoder);

            let width = inputGif.width;
            let {
                interval,
                shift,
                shiftSize
            } = prepareSlidingVariables(width, options.value);
            let frames = gifhelper.alignGif(inputGif.frames, interval);

            let direction = options.name === 'sliderev' ? 1 : -1;
            for (let i = 0; i < frames.length; i++) {
                encoder.setDelay(frames[i].delayCentisecs * 10);
                let shiftedBitmap = getShiftedFrameData(new Jimp(frames[i].bitmap), shift);
                encoder.addFrame(shiftedBitmap.data);
                shift = (shift + direction * shiftSize) % width;
            }

            encoder.finish();
        }).catch(reject);
    });
};

exports.createSlidingPNG = (options) => {
    return new Promise((resolve, reject) => {
        Jimp.read(options.buffer).then(image => {
            let {
                width,
                height,
                encoder
            } = gifhelper.preparePNGVariables(options, image.bitmap);
            image.resize(width, height);

            let {
                interval,
                shift,
                shiftSize
            } = prepareSlidingVariables(width, options.value);
            gifhelper.getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
            gifhelper.setEncoderProperties(encoder, 40);

            let direction = options.name === 'sliderev' ? 1 : -1;
            for (let i = 0; i < interval; i++) {
                let frameData = getShiftedFrameData(image, shift);
                encoder.addFrame(frameData.data);
                shift = (shift + direction * shiftSize) % width;
            }

            encoder.finish();
        }).catch(reject);
    });
};

function prepareSlidingVariables(width, speed) {
    let interval = speed * 2;
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
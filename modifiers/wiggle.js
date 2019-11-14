const GIFEncoder = require('gifencoder');
const Jimp = require('jimp');
const gifhelper = require('../gifhelper.js');

exports.createWigglingGIF = (options) => {
    return new Promise((resolve, reject) => {
        gifhelper.getGifFromBuffer(options.buffer).then(inputGif => {
            let encoder = new GIFEncoder(inputGif.width, inputGif.height);
            gifhelper.getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
            gifhelper.setEncoderProperties(encoder);

            let width = inputGif.width + 2 * Math.floor(inputGif.width * options.value * 0.1 / 15);
            let margin = width - inputGif.width;

            let {
                shiftSize,
                interval,
                stripeHeight,
                shift,
                left
            } = prepareWiggleVariables(margin, inputGif.height);
            let frames = gifhelper.alignGif(inputGif.frames, interval);

            for (let i = 0; i < frames.length; i++) {
                encoder.setDelay(frames[i].delayCentisecs * 10);
                let wiggledBitmap = getWiggledFrameData(
                    new Jimp(frames[i].bitmap),
                    shift,
                    left, {
                        stripeHeight,
                        shiftSize,
                        width: inputGif.width,
                        margin
                    },
                );
                encoder.addFrame(wiggledBitmap.data);
                // Set initial wiggle offset for next frame
                [shift, left] = shiftWiggleStep(shift, left, margin, shiftSize);
            }

            encoder.finish();
        }).catch(reject);
    });
};

exports.createWigglingPNG = (options) => {
    return new Promise((resolve, reject) => {
        Jimp.read(options.buffer).then(image => {
            let {
                width: imgWidth,
                height
            } = gifhelper.preparePNGVariables(options, image.bitmap);
            image.resize(imgWidth, height);

            let width = imgWidth + 2 * Math.floor(imgWidth * options.value * 0.1 / 15);
            let margin = width - imgWidth;

            let encoder = new GIFEncoder(width, height);
            let {
                shiftSize,
                interval,
                stripeHeight,
                shift,
                left
            } = prepareWiggleVariables(margin, height);

            gifhelper.getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
            gifhelper.setEncoderProperties(encoder, 80);

            for (let i = 0; i < interval; i++) {
                // Wiggle frame
                let wiggledBitmap = getWiggledFrameData(image, shift, left, {
                    stripeHeight,
                    shiftSize,
                    width,
                    margin
                });
                encoder.addFrame(wiggledBitmap.data);
                // Set initial wiggle offset for next frame
                [shift, left] = shiftWiggleStep(shift, left, margin, shiftSize);
            }

            encoder.finish();
        }).catch(reject);
    });
};

function prepareWiggleVariables(margin, height) {
    let shiftSize = Math.max(1, margin / 6);
    let interval = 2 * (margin / shiftSize + 4);
    let stripeHeight = Math.max(1, Math.floor(height / 32));
    let shift = margin / 2; // Initial offset of wiggle
    let left = true; // true -> go to left
    return {
        shiftSize,
        interval,
        stripeHeight,
        shift,
        left
    };
}

function getWiggledFrameData(oldFrame, shift, left, options) {
    let newFrame = new Jimp(options.width, oldFrame.bitmap.height);
    // Wiggle each stripe
    for (let stripe = 0; stripe < oldFrame.bitmap.height; stripe += options.stripeHeight) {
        newFrame.blit(oldFrame, shift, stripe, 0, stripe, oldFrame.bitmap.width, options.stripeHeight);
        [shift, left] = shiftWiggleStep(shift, left, options.margin, options.shiftSize);
    }
    return newFrame.bitmap;
}

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
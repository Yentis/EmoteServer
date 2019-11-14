const GIFEncoder = require('gifencoder');
const Jimp = require('jimp');
const gifhelper = require('../gifhelper.js');

exports.createSpinningGIF = (options) => {
    return new Promise((resolve, reject) => {
        gifhelper.getGifFromBuffer(options.buffer).then(inputGif => {
            let encoder = new GIFEncoder(inputGif.width, inputGif.height);
            gifhelper.getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer)).catch(reject);
            gifhelper.setEncoderProperties(encoder);

            let {
                degrees,
                interval,
                max,
                margin
            } = prepareSpinVariables(
                inputGif.frames[0].delayCentisecs, // assuming all frames have the same delay
                200 * options.value / 8, // 100cs per rotation -> 1 rotation per second
                options.name === 'spinrev',
                inputGif.width,
                inputGif.height
            );

            let frames = gifhelper.alignGif(inputGif.frames, interval);
            for (let i = 0; i < frames.length; i++) {
                encoder.setDelay(frames[i].delayCentisecs * 10);
                let adjustedImg = new Jimp(max, max);

                if (inputGif.width > inputGif.height) {
                    adjustedImg.blit(new Jimp(frames[i].bitmap), 0, margin);
                } else {
                    adjustedImg.blit(new Jimp(frames[i].bitmap), margin, 0);
                }

                adjustedImg.rotate((i * degrees) % 360, false);
                encoder.addFrame(adjustedImg.bitmap.data);
            }

            encoder.finish();
        }).catch(error => reject(error));
    });
}

exports.createSpinningPNG = (options) => {
    return new Promise((resolve, reject) => {
        Jimp.read(options.buffer).then(image => {
            let {
                width,
                height
            } = gifhelper.preparePNGVariables(options, image.bitmap);
            let {
                degrees,
                interval,
                max,
                margin
            } = prepareSpinVariables(
                options.value, // delay
                200 * options.value / 8, // 100cs per rotation -> 1 rotation per second
                options.name === 'spinrev',
                width,
                height
            );
            let encoder = new GIFEncoder(max, max);
            image.resize(width, height);

            let resizedImage = new Jimp(max, max);
            image = width > height ?
                resizedImage.blit(image, 0, margin) :
                resizedImage.blit(image, margin, 0);

            gifhelper.getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer)).catch(reject);
            gifhelper.setEncoderProperties(encoder, options.value * 10);

            for (let i = 0; i < interval; i++) {
                let rotatedImage = new Jimp(resizedImage.bitmap);
                rotatedImage.rotate(i * degrees, false);
                encoder.addFrame(rotatedImage.bitmap.data);
            }
            encoder.finish();
        }).catch(error => reject(error));
    });
};

function prepareSpinVariables(delay, centisecsPerRotation, reverse, width, height) {
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
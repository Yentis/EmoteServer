const {
    GifUtil,
    GifFrame
} = require('gifwrap');
const GIFEncoder = require('gifencoder');
const Jimp = require('jimp');
const gifhelper = require('../gifhelper.js');

exports.createShakingGIF = (options) => {
    return new Promise((resolve, reject) => {
        gifhelper.getGifFromBuffer(options.buffer).then(inputGif => {
            // centi secs till next shake position, presumably either 8 (default), 6 (fast), 4 (faster), or 2 (hyper)
            let speed = Math.max(2, options.value);
            // centi secs till next gif frame, assuming all frames have the same delay
            let delay = inputGif.frames[0].delayCentisecs;

            let frames = inputGif.frames;
            // If delay > speed, interval says how many shake positions each frame will have, otherwise = 1
            let interval = 1;
            // If speed > delay, 1 / incrValue says how many frames will stay at the same shake position, otherwise = 1
            let incrValue = 1;

            if (delay !== speed) {
                let padAmount = lowestCommonDenominator(delay, speed) / speed;
                // If the padded gif would have too many frames already (800 is arbitrary)
                if (frames.length * padAmount > 800) {
                    // Delete every second frame
                    frames = frames.filter((_, i) => i % 2 === 0);
                    delay *= 2;
                    speed *= 2;
                }
                frames = padGif(frames, padAmount);
                if (delay > speed) {
                    delay /= padAmount;
                    interval = speed / greatestCommonDenominator(delay, speed);
                    // Keeping delay above 1 for encoder
                    if (delay === 1) interval /= 2;
                } else if (delay < speed) {
                    delay /= padAmount;
                    incrValue = greatestCommonDenominator(delay, speed) / speed;
                    // Keeping delay above 1 for encoder
                    if (delay === 1) incrValue /= 2;
                }
                // Keeping delay above 1 for encoder
                if (delay === 1) {
                    // Make it even amount of frames by deleting one  if necessary
                    if (frames.length % 2 !== 0) {
                        let frameToDelete = Math.floor(Math.random() * frames.length - 1) + 1;
                        frames.splice(frameToDelete, 1);
                    }
                    // Delete every second frame
                    frames = frames.filter((_, i) => i % 2 === 0);
                    delay = 2;
                }
                // Not sure why this here is needed and also no clue whether this breaks the result for some gifs
                incrValue *= 4;
            }

            let dx = 0,
                dy = 0,
                sx = 1,
                sy = 1;
            // Move dx dy sx dy: 0011 (3) -> 0110 (6) -> 1100 (12) -> 1001 (9) -> 0011 (3)
            let offsets = 3;
            let state = 0; // Keeps track of how far it is into the interval

            let encoder = new GIFEncoder(inputGif.width, inputGif.height);
            gifhelper.getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer)).catch(reject);
            gifhelper.setEncoderProperties(encoder, delay * 10);

            for (let i = 0; i < frames.length; i++) {
                state += incrValue;
                if (state >= interval) {
                    state -= interval;
                    // Shift dx, dy, sx, sy
                    offsets <<= 1;
                    if (offsets > 16) offsets -= 15; // remove first one (-16) and add it on the right (+1)
                    dx = offsets >> 3;
                    dy = (offsets >> 2) & 1;
                    sx = (offsets >> 1) & 1;
                    sy = offsets & 1;
                }
                // Shake frame
                let shakenFrame = new Jimp(inputGif.width, inputGif.height, 0x00);
                shakenFrame.blit(new Jimp(frames[i].bitmap), dx, dy, sx, sy, inputGif.width - 1, inputGif.height - 1);
                encoder.addFrame(shakenFrame.bitmap.data);
            }

            encoder.finish();
        }).catch(error => reject(error));
    });
};

exports.createShakingPNG = (options) => {
    return new Promise((resolve, reject) => {
        Jimp.read(options.buffer).then(image => {
            let {
                width,
                height,
                encoder
            } = gifhelper.preparePNGVariables(options, image.bitmap);
            image.resize(width, height);
            gifhelper.getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer)).catch(reject);
            gifhelper.setEncoderProperties(encoder, options.value * 10);

            for (let i = 0; i < 4; i++) {
                let frame = new Jimp(width, height, 0x00);
                switch (i) {
                    case 0:
                        frame.blit(new Jimp(image.bitmap), 0, 0, 1, 1, width - 1, height - 1);
                        break;
                    case 1:
                        frame.blit(new Jimp(image.bitmap), 0, 1, 1, 0, width - 1, height - 1);
                        break;
                    case 2:
                        frame.blit(new Jimp(image.bitmap), 1, 1, 0, 0, width - 1, height - 1);
                        break;
                    case 3:
                        frame.blit(new Jimp(image.bitmap), 1, 0, 0, 1, width - 1, height - 1);
                        break;
                }
                encoder.addFrame(frame.bitmap.data);
            }

            encoder.finish();
        }).catch(reject);
    });
};

function lowestCommonDenominator(a, b) {
    return (a * b) / greatestCommonDenominator(a, b);
}

function greatestCommonDenominator(a, b) {
    return !b ? a : greatestCommonDenominator(b, a % b);
}

function padGif(frames, amountCopies) {
    if (amountCopies < 2) return GifUtil.cloneFrames(frames);
    let copiedFrames = [];
    for (let i = 0; i < frames.length; i++) {
        for (let j = 0; j < amountCopies; j++) {
            copiedFrames.push(new GifFrame(frames[i].bitmap));
        }
    }
    return copiedFrames;
}
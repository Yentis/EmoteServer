const GIFEncoder = require('gifencoder');
const Jimp = require('jimp');
let gifhelper = require('../gifhelper.js');

exports.createRainbowGIF = (options) => {
    return new Promise((resolve, reject) => {
        gifhelper.getGifFromBuffer(options.buffer).then(inputGif => {
            let encoder = new GIFEncoder(inputGif.width, inputGif.height);
            gifhelper.getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer)).catch(reject);
            gifhelper.setEncoderProperties(encoder);

            let interval = 32 * options.value;
            let frames = gifhelper.alignGif(inputGif.frames, interval);
            let randomBlack = Math.random();
            let randomWhite = Math.random();

            for (let i = 0; i < frames.length; i++) {
                encoder.setDelay(frames[i].delayCentisecs * 10);
                let frame = frames[i];
                shiftColors(frame.bitmap, (i % interval) / interval, randomBlack, randomWhite);
                encoder.addFrame(frame.bitmap.data);
            }

            encoder.finish();
        }).catch(error => reject(error));
    });
};

exports.createRainbowPNG = (options) => {
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

            let amountFrames = 32; // arbitrary
            let interval = 1 / amountFrames; // hue shift per step
            let randomBlack = Math.random();
            let randomWhite = Math.random();

            for (let i = 0; i < amountFrames; i++) {
                shiftColors(image.bitmap, interval, randomBlack, randomWhite);
                encoder.addFrame(image.bitmap.data);
            }

            encoder.finish();
        }).catch(reject);
    });
};

function shiftColors(bitmap, interval, randomBlack, randomWhite) {
    for (let i = 0; i < bitmap.data.length; i += 4) {
        if (bitmap.data[i + 3] > 0) { // only recolor if non-transparent
            let colors = shiftColor(bitmap.data, i, interval, randomBlack, randomWhite);

            while (colors[0] > 1) colors[0]--;
            colors = hsl2rgb(colors[0], colors[1], colors[2]);
            bitmap.data.set(colors, i);
        }
    }
}

function shiftColor(bitmap, index, shiftAmount, randomBlack, randomWhite) {
    let initialColors = [bitmap[index], bitmap[index + 1], bitmap[index + 2]];
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
    r /= 255;
    g /= 255;
    b /= 255;
    let max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }
    return [h, s, l];
}

// h, s, l in [0, 1] ~ r, g, b in [0, 255]
function hsl2rgb(h, s, l) {
    let r, g, b, q, p;
    if (s === 0) {
        r = g = b = l;
    } else {
        q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r * 255, g * 255, b * 255];
}

function hue2rgb(p, q, t) {
    if (t < 0) t++;
    else if (t > 1) t--;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}
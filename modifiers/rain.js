const GIFEncoder = require('gifencoder');
const Jimp = require('jimp');
const gifhelper = require('../gifhelper.js');

exports.createRainingGIF = (options) => {
    return new Promise((resolve, reject) => {
        gifhelper.getGifFromBuffer(options.buffer).then(inputGif => {
            let encoder = new GIFEncoder(inputGif.width, inputGif.height);
            gifhelper.getBuffer(encoder.createReadStream()).then(buffer => resolve(buffer)).catch(reject);
            gifhelper.setEncoderProperties(encoder);

            let frames = inputGif.frames;
            let rainGenerator = rainImageGenerator(inputGif.width, inputGif.height, options.value === 1);

            for (let i = 0; i < frames.length; i++) {
                encoder.setDelay(frames[i].delayCentisecs * 10);
                let frame = new Jimp(frames[i].bitmap);
                frame.blit(rainGenerator.next(), 0, 0);
                encoder.addFrame(frame.bitmap.data);
            }

            encoder.finish();
        }).catch(error => reject(error));
    });
};

exports.createRainingPNG = (options) => {
    return new Promise((resolve, reject) => {
        Jimp.read(options.buffer).then(image => {
            let {
                width,
                height,
                encoder
            } = gifhelper.preparePNGVariables(options, image.bitmap);
            image.resize(width, height);
            let delay = 8;

            gifhelper.getBuffer(encoder.createReadStream()).then(resolve).catch(reject);
            gifhelper.setEncoderProperties(encoder, delay * 10);

            let interval = 12;
            let rainGenerator = rainImageGenerator(width, height, options.value === 1);

            for (let i = 0; i < interval; i++) {
                let img = new Jimp(image.bitmap);
                img.blit(rainGenerator.next(), 0, 0);
                encoder.addFrame(img.bitmap.data);
            }

            encoder.finish();
        }).catch(reject);
    });
};

function rainImageGenerator(width, height, glitter) {
    // Generate single drops
    let drops = [];
    for (let i = 0, amount = (width + height) / 5; i < amount; i++) {
        drops.push(new Drop(width, height));
    }

    const rainGenerator = {
        next: function() {
            let img = new Jimp(width, height, 0x00);
            // Draw raindrops
            for (let i = 0; i < drops.length; i++) {
                let drop = drops[i];
                let r, g, b;
                if (glitter) {
                    r = Math.random() * 256;
                    g = Math.random() * 256;
                    b = Math.random() * 256;
                } else {
                    r = 0, g = 120, b = 255;
                }
                for (let j = 0; j < drop.len; j++) {
                    for (let k = 0; k < drop.size; k++) {
                        let pos = (Math.floor(drop.y + j) * width + Math.floor(drop.x + k)) * 4;
                        img.bitmap.data[pos] = r;
                        img.bitmap.data[pos + 1] = g;
                        img.bitmap.data[pos + 2] = b;
                        img.bitmap.data[pos + 3] = 255;
                    }
                }
                // Simulate next step
                drop.fall();
            }
            return img;
        }
    }
    return rainGenerator;
}

function Drop(width, height) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;

    // Speed depends on height (make dependant on frame delay?)
    let speed = Math.random() * (2 * height / 15) + height / 15;
    // Map len between 1 and 5, depending on the speed
    this.len = Math.floor(((speed - (height / 15)) / (height / 5)) * 5 + 1);
    // Map thickness between 1 and 2, depending on the speed
    this.size = Math.floor(((speed - (height / 15)) / (height / 5)) * 2 + 1);

    this.fall = function() {
        this.y += speed;
        // Reset drop
        if (this.y > height) {
            this.y = 0;
            speed = Math.random() * (2 * height / 15) + height / 15;
        }
    }
}

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
            let glitter = options.value === 1;
            let rainGenerator = rainImageGenerator(inputGif.width, inputGif.height, glitter, frames[0].delayCentisecs);

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
            let glitter = options.value === 1;
            let rainGenerator = rainImageGenerator(width, height, glitter, delay);

            for (let i = 0; i < interval; i++) {
                let img = new Jimp(image.bitmap);
                img.blit(rainGenerator.next(), 0, 0);
                encoder.addFrame(img.bitmap.data);
            }

            encoder.finish();
        }).catch(reject);
    });
};

function rainImageGenerator(width, height, glitter, delay) {
    // Generate single drops
    let drops = [];
    for (let i = 0, amount = (width + height) / 5; i < amount; i++) {
        drops.push(new Drop(width, height, delay));
    }
    // Set colors of drops
    if (glitter) {
        drops.forEach(drop => drop.setColor(Math.random() * 256, Math.random() * 256, Math.random() * 256));
    } else {
        drops.forEach(drop => drop.setColor(0, 120, 255));
    }

    const rainGenerator = {
        next: function() {
            let img = new Jimp(width, height, 0x00);
            // Draw raindrops
            for (let i = 0; i < drops.length; i++) {
                let drop = drops[i];
                for (let j = 0; j < drop.len; j++) {
                    for (let k = 0; k < drop.size; k++) {
                        let pos = (Math.floor(drop.y + j) * width + Math.floor(drop.x + k)) * 4;
                        img.bitmap.data[pos + 0] = drop.r;
                        img.bitmap.data[pos + 1] = drop.g;
                        img.bitmap.data[pos + 2] = drop.b;
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

function Drop(width, height, delay) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;

    let { speed, len, size } = resetDrop(delay);
    this.len = len;
    this.size = size;

    this.fall = function() {
        this.y += speed;
        if (this.y > height) {
            this.y = 0;
            let { speed, len, size } = resetDrop(delay);
            this.len = len;
            this.size = size;
        }
    }

    this.setColor = function(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
}

function resetDrop(delay) {
    let speed = Math.random();
    // Map len between 1 and 5, depending on the speed
    let len = Math.floor(speed * 5 + 1);
    // Map thickness between 1 and 2, depending on the speed
    let size = Math.floor(speed * 2 + 1);
    // Adjust speed to frame delay i.e. the longer the delay, the faster the drop
    speed = Math.floor(speed * delay + delay);
    return { speed, len, size };
}
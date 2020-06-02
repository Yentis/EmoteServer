// server.js
// where your node app starts
// init project
const Gifsicle = require('gifsicle-stream');
const request = require('request');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const base64 = require('base-64');
const toStream = require('buffer-to-stream');
const gifhelper = require('./gifhelper.js');
const githelper = require('./githelper.js');
const app = express();
let jsonParser = bodyParser.json({
  limit: '50mb'
});
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});
module.exports.localBuild = true;

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', 'https://discordapp.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  next();
});
app.use(express.static('public'));
app.use('/newemote', require('./discord.js'));
app.set('view engine', 'pug');

app.get('/test', (req, res) => {
  res.render('test');
});

app.get("/", (request, response) => {
  response.sendStatus(200);
});


/* Commit Emote */


const fileInfo = {
  emoteBasePath: 'emotes/images/',
  emoteDescription: ' added an emote.',
  jsonPath: 'emotes/emotes.json',
  jsonDescription: 'Update JSON',
  jsonEncode: true
};

app.post('/commit', jsonParser, function (req, res) {
  if (!isBodyValid(req.body, 'newemote')) {
    logger.log('warn', 'Received invalid commit request', req.body);
    return res.sendStatus(400);
  }

  githelper.getFile(fileInfo.jsonPath)
    .then((emoteList) => {
      logger.log('info', 'Got emote list');
      let file = processData(req.body, JSON.parse(emoteList));
      if (file.err) {
        logger.log('warn', 'Failed to process data', file.err);
        res.end(file.err.toString());
      } else {
        logger.log('info', 'Processed emote data');
        commitEmote(file, req.body.username)
          .then(() => {
            logger.log('info', 'Emote added');
            res.end('ok');
          }).catch(err => {
            logger.log('warn', 'Failed to add emote', err);
            res.end(err.toString());
          });
      };
    }).catch(err => {
      logger.log('warn', 'Failed to get emote list', err);
      res.end(err.toString());
    });
});

function commitEmote(file, username) {
  return new Promise((resolve, reject) => {
    let filesToWrite = [];
    filesToWrite.push({
      filename: file.filename,
      content: file.content,
      description: username + fileInfo.emoteDescription
    });
    filesToWrite.push({
      filename: fileInfo.jsonPath,
      content: file.jsonContent,
      description: fileInfo.jsonDescription,
      encode: fileInfo.jsonEncode
    });
    githelper.writeFiles(filesToWrite).then(resolve()).catch(err => reject(err));
  });
}

function processData(data, emotes) {
  let file = data.file;
  if (checkNameExists(file.emoteName, emotes)) {
    return {
      err: "Emote name already exists!"
    };
  }

  let emoteNumber = Object.keys(emotes).length + 1;

  emotes[emoteNumber] = file.emoteName + file.extension;
  let newJson = JSON.stringify(emotes);
  if (newJson === undefined) {
    return {
      err: "A problem occurred while adding your emote, please check your file."
    };
  }

  return {
    filename: fileInfo.emoteBasePath + emoteNumber + file.extension,
    content: base64.encode(file.content),
    width: file.width,
    jsonContent: newJson,
  };
}

function checkNameExists(emoteName, existingNames) {
  for (let key in existingNames) {
    if (existingNames.hasOwnProperty(key)) {
      let emote = existingNames[key].split('.');
      if (emote[0] === emoteName) {
        return key + "." + emote[1];
      }
    }
  }

  return false;
}


/* Modify Emote */


app.post('/modifygif', jsonParser, (req, res) => {
  if (!isBodyValid(req.body, 'modify')) {
    logger.log('warn', 'Received invalid modify request', req.body);
    return res.sendStatus(400);
  }

  let data = req.body;
  data.commands = getCommands(data.options);
  logger.log('info', 'Processed request commands', data.commands);

  processCommands(data)
    .then(buffer => {
      logger.log('info', 'Processed modified emote', {
        length: buffer.length
      });
      res.status(200);
      res.send(buffer.toString('base64'));
    }).catch(err => {
      logger.log('warn', 'Failed to modify emote ', err);
      res.status(400);
      res.send(err);
    });
});

function getCommands(options) {
  let normal = [];
  let special = [];
  let priority = [];
  let command = {};

  options.forEach((option) => {
    command = {};
    switch (option[0]) {
      case 'resize':
        command.name = '--scale';
        command.param = option[1];

        let split = command.param.toString().split('x');
        let shouldProcessAfter = false;
        split.forEach(axis => {
          if (axis > 1) shouldProcessAfter = true;
        });

        if (shouldProcessAfter) {
          normal.push(command);
        } else {
          priority.push(command);
        }
        break;
      case 'reverse':
        command.name = '#-1-0';
        normal.push(command);
        break;
      case 'rotate':
        command.name = '--rotate-' + option[1];
        command.param = '#0-';
        normal.push(command);
        break;
      case 'flip':
        command.name = '--flip-horizontal';
        normal.push(command);
        break;
      case 'flap':
        command.name = '--flip-vertical';
        normal.push(command);
        break;
      case 'speed':
        command.name = '-d' + Math.max(2, parseInt(option[1]));
        normal.push(command);
        break;
      case 'hyperspeed':
        command.name = 'hyperspeed';
        normal.push(command);
        break;
      case 'wiggle':
        let size = 2;

        if (option[1]) {
          let sizeName = option[1];

          if (sizeName === 'big') size = 4;
          else if (sizeName === 'bigger') size = 6;
          else if (sizeName === 'huge') size = 10;
        }

        command.name = option[0];
        command.param = size;
        special.push(command);
        break;
      case 'rain':
        command.name = option[0];
        command.param = option[1] === 'glitter' ? 1 : 0;
        special.push(command);
        break;
      case 'spin':
      case 'spinrev':
      case 'shake':
      case 'rainbow':
      case 'infinite':
      case 'slide':
      case 'sliderev':
        let speed = 8;

        if (option[1]) {
          let speedName = option[1];

          if (speedName === 'fast') speed = 6;
          else if (speedName === 'faster') speed = 4;
          else if (speedName === 'hyper') speed = 2;
        }

        command.name = option[0];
        command.param = speed;
        special.push(command);
        break;
    }
  });

  return {
    priority,
    special,
    normal
  };
}

function processCommands(data) {
  return new Promise(async (resolve, reject) => {
    let fileType = data.url.endsWith('gif') ? 'gif' : 'png';
    let buffer = data.url;
    let size;

    try {
      if (fileType === 'gif') {
        // Priority commands (namely resizing) must be done before unoptimizing or it will cause glitches
        if (data.commands.priority.length > 0) {
          buffer = await modifyGif(buffer, data.commands.priority);
        }

        buffer = await modifyGif(buffer, [{
          name: '--unoptimize'
        }]);
      }

      if (fileType === 'png') {
        let scaleIndex = getCommandIndexByProperty(data.commands.priority, 'name', '--scale');
        if (typeof scaleIndex !== 'undefined') {
          size = data.commands.priority[scaleIndex].param;
        }
      }

      if (data.commands.special.length > 0) {
        buffer = await processSpecialCommands({
          data: buffer,
          commands: data.commands.special,
          fileType,
          size
        });
      }

      if (data.commands.normal.length > 0) {
        buffer = await processNormalCommands(buffer, data.commands.normal);
      }

      buffer = await modifyGif(buffer, [{
        name: '--optimize'
      }]);

      resolve(buffer);
    } catch (err) {
      reject(err);
    }
  });
}

function modifyGif(data, options) {
  return new Promise((resolve, reject) => {
    let gifsicleParams = [];
    options.forEach((option) => {
      gifsicleParams.push(option.name);
      if (option.param) {
        gifsicleParams.push(option.param);
      }
    });
    let gifProcessor = new Gifsicle(gifsicleParams);
    let readStream;

    if (Buffer.isBuffer(data)) readStream = toStream(data);
    else {
      readStream = request(data, (err) => {
        if (err) reject(err);
      });
    }

    let buffers = [];
    readStream
      .pipe(gifProcessor)
      .on('data', (chunk) => buffers.push(chunk))
      .on('error', (err) => reject(err))
      .on('end', () => resolve(Buffer.concat(buffers)));
  });
}

function processSpecialCommands(options) {
  return new Promise((mainResolve, mainReject) => {
    let commands = options.commands;
    if (commands.length > 0) {
      let currentBuffer = options.data;

      logger.log('info', 'Commands count: ' + commands.length);
      for (let i = 0, p = Promise.resolve(); i < commands.length; i++) {
        p = p.then(_ => new Promise((resolve, reject) => {
          processSpecialCommand({
            name: commands[i].name,
            value: parseInt(commands[i].param),
            buffer: currentBuffer,
            type: i === 0 ? options.fileType : 'gif',
            size: options.size || 1,
            isResized: i > 0
          }).then(buffer => {
            currentBuffer = buffer;
            if (i === commands.length - 1) {
              mainResolve(currentBuffer);
            } else resolve();
          }).catch(err => reject(err));
        })).catch(err => mainReject(err));
      }
    } else mainResolve(options.data);
  });
}

function processSpecialCommand(command) {
  return new Promise((resolve, reject) => {
    logger.log('info', 'Command name: ' + command.name);
    switch (command.name) {
      case 'spin':
      case 'spinrev':
        gifhelper.spinEmote(command).then(resolve).catch(reject);
        break;
      case 'shake':
        gifhelper.shakeEmote(command).then(resolve).catch(reject);
        break;
      case 'rainbow':
        gifhelper.rainbowEmote(command).then(resolve).catch(reject);
        break;
      case 'wiggle':
        gifhelper.wiggleEmote(command).then(resolve).catch(reject);
        break;
      case 'infinite':
        gifhelper.infiniteEmote(command).then(resolve).catch(reject);
        break;
      case 'slide':
      case 'sliderev':
        gifhelper.slideEmote(command).then(resolve).catch(reject);
        break;
      case 'rain':
        gifhelper.rainEmote(command).then(resolve).catch(reject);
        break;
      default:
        resolve(command.buffer);
        break;
    };
  });
}

function processNormalCommands(data, commands) {
  return new Promise((resolve, reject) => {
    modifyGif(data, [{
        name: '-I'
      }])
      .then((info) => {
        commands.unshift({
          name: '-U'
        });

        let hyperspeedIndex = getCommandIndexByProperty(commands, 'name', 'hyperspeed');
        if (typeof hyperspeedIndex !== 'undefined') {
          commands.splice(hyperspeedIndex, 1);
          commands = removeEveryOtherFrame(2, commands, info);
        }

        modifyGif(data, commands)
          .then(resolve).catch(reject);
      }).catch(reject);
  });
}

function getCommandIndexByProperty(commands, property, name) {
  for (let i = 0; i < commands.length; i++) {
    if (commands[i][property] === name) return i;
  }
}

function removeEveryOtherFrame(n, commands, data) {
  commands.push({
    name: '-d2'
  });

  let frameCount = data.toString('utf8').split('image #').length - 1;
  if (frameCount <= 4) return commands;
  commands.push({
    name: '--delete'
  });

  for (let i = 1; i < frameCount; i += n) {
    commands.push({
      name: '#' + i
    });
  }

  return commands;
}

function isBodyValid(body, type) {
  if (type === 'modify') {
    return !!(body && body.url && body.options && Array.isArray(body.options));
  } else if (type === 'newemote') {
    return !!(body && body.username && body.file.emoteName && body.file.extension && body.file.content && body.file.width);
  }
}

// listen for requests :)
if (this.localBuild) {
  app.listen(8080);
} else {
  app.listen(process.env.PORT);
  setInterval(() => {
    http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
  }, 280000);
}
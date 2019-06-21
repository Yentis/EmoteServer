const GitHub = require('./github');
let config = {
  username: 'Yentis',
  password: process.env.GIT,
  auth: 'basic',
  repository: 'yentis.github.io',
  branchName: 'master'
};
let gitHub = new GitHub(config);

class GitFile {
  constructor(options) {
    this.filename = options.filename;
    this.content = options.content;
    this.description = options.description;
    this.encode = options.encode || false;
  };
}

exports.writeFiles = function(files) {
  return new Promise((mainResolve, mainReject) => {
    for (let i = 0, p = Promise.resolve(); i < files.length; i++) {
        p = p.then(_ => new Promise((resolve, reject) => {
          writeFile(new GitFile(files[i])).then(() => {
            if(i === files.length - 1) mainResolve();
            else resolve();
          }).catch(err => reject(err));
        })).catch(err => mainReject(err));
      }
  });
};

function writeFile(file) {
  return new Promise((resolve, reject) => {
    gitHub.repository.writeFile(
      config.branchName,
      file.filename,
      file.content,
      file.description, {
        encode: file.encode
      },
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

exports.deleteFile = function(filename) {
  return new Promise((resolve, reject) => {
    gitHub.repository.deleteFile(
      config.branchName,
      filename,
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

exports.getFile = function(path) {
  return new Promise((resolve) => {
    gitHub.repository.getContents('master', path, false, function(result1, result2) {
      resolve(Buffer.from(result2.content, 'base64').toString());
    });
  });
};

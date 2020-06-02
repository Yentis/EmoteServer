const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const FormData = require('form-data');
const btoa = require('btoa');
const localBuild = require('./server.js').localBuild;
const redirect = localBuild ? 'http://localhost:8080/newemote' : 'https://yentis.glitch.me/newemote';
const clientId = localBuild ? 'CLIENT_ID_HERE' : process.env.CLIENT_ID;
const clientSecret = localBuild ? 'SECRET_HERE' : process.env.CLIENT_SECRET;
const scopes = 'identify';

router.get('/', (req, res) => {
    if (!req.query.code) {
        res.render('index');
        return;
    }

    const code = req.query.code;
    getAccessToken(code)
    .then(result => {
        getUser(result.access_token)
        .then(user => {
            res.render('index', {username: `${user.username}#${user.discriminator}`});
        }).catch(error => res.end(error));
    })
    .catch(error => res.end(error));
});

router.get('/login', (req, res) => {
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${scopes}`);
});

function getAccessToken(code) {
    return new Promise((resolve, reject) => {
        const data = new FormData();
        data.append('client_id', clientId);
        data.append('client_secret', clientSecret);
        data.append('grant_type', 'authorization_code');
        data.append('code', code);
        data.append('redirect_uri', redirect);

        fetch('https://discord.com/api/oauth2/token',
        {
          method: 'POST',
          body: data
        }).then(response => {
            if (response.status !== 200) {
              reject(response.statusText);
            } else {
              response.json()
              .then(resolve)
              .catch(error => reject(error.toString()));
            }
        }).catch(error => reject(error.toString()));
    });
}

function getUser(accessToken) {
    return new Promise((resolve, reject) => {
        fetch(`https://discord.com/api/users/@me`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }).then(response => {
            response.json()
            .then(resolve)
            .catch(error => reject(error.toString()));
        }).catch(error => reject(error.toString()));
    });
}

module.exports = router;
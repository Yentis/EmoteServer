const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const btoa = require('btoa');
const redirect = encodeURIComponent('https://yentis.glitch.me/newemote');

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
  res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&scope=identify&response_type=code&redirect_uri=${redirect}`);
});

function getAccessToken(code) {
    return new Promise((resolve, reject) => {
        const creds = btoa(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`);
        fetch(`https://discordapp.com/api/oauth2/token?grant_type=authorization_code&code=${code}&redirect_uri=${redirect}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${creds}`,
          },
        }).then(response => {
            response.json()
            .then(resolve)
            .catch(error => reject(error.toString()));
        }).catch(error => reject(error.toString()));
    });
}

function getUser(accessToken) {
    return new Promise((resolve, reject) => {
        fetch(`https://discordapp.com/api/users/@me`,
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
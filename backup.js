const express = require('express');
const app = express();
const qrcode = require('qrcode');
const axios = require('axios');
const { Client } = require('whatsapp-web.js');
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');

const apiInstance = axios.create({
  baseURL: 'https://pay.maxp254.co.ke'
});

const clients = {};

function isAuthenticated(req, res, next) {
  if (req.authenticatedUser) {
    // User is authenticated, proceed to the next middleware or route handler
    next();
  } else {
    // User is not authenticated, send an error response
    res.status(401).send('Unauthorized');
  }
}

app.post('/:deviceId/send-message', isAuthenticated, express.json(), (req, res) => {
  const recipient = req.body.recipient;
  const message = req.body.message;

  const client = clients[req.params.deviceId].client;

  client.sendMessage(recipient, message)
    .then(() => {
      res.send('Message sent successfully');
    })
    .catch((error) => {
      console.error('Error sending message:', error);
      res.send('Error sending message');
    });
});

app.post('/:deviceId/send-media', express.json(), async (req, res) => {
  const recipient = req.body.recipient;
  const mediaUrl = req.body.mediaUrl;
  const caption = req.body.caption;

  const client = clients[req.params.deviceId].client;

  try {
    const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    const mediaData = response.data;

    const mediaFilePath = 'temp-media-file.jpg';
    fs.writeFileSync(mediaFilePath, mediaData);

    const media = MessageMedia.fromFilePath(mediaFilePath);

    await client.sendMessage(recipient, media, { caption: caption });

    fs.unlinkSync(mediaFilePath);

    res.send('Media message sent successfully');
  } catch (error) {
    console.error('Error sending media message:', error);
    res.send('Error sending media message');
  }
});

app.get('/:deviceId/qrcode', (req, res) => {
  const qrCodeDataUrl = clients[req.params.deviceId].qrCodeDataUrl;

  if (qrCodeDataUrl) {
    res.send(`<img src="${qrCodeDataUrl}">`);
  } else {
    res.send('QR code not available yet');
  }
});

app.post('/:deviceId/qrcode-data', express.json(), (req, res) => {
  const qrCodeDataUrl = req.body.qrCodeDataUrl;
  clients[req.params.deviceId].qrCodeDataUrl = qrCodeDataUrl;
  res.sendStatus(200);
});

function createClient(deviceId) {
  const client = new Client();
  clients[deviceId] = {
    qrCodeDataUrl: null,
    client: client
  };

  client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, dataUrl) => {
      if (err) {
        console.error(err);
        // Handle the error accordingly
      }

      clients[deviceId].qrCodeDataUrl = dataUrl;
    });
  });

  client.on('authenticated', (session) => {
    console.log(`Device ${deviceId} authenticated`);
  });

  client.initialize();
}

// Create clients for each device
const deviceIds = ['device1', 'device2', 'device3', 'device4', 'device5', 'device6', 'device7', 'device8', 'device9', 'device10'];
deviceIds.forEach((deviceId) => {
  createClient(deviceId);
});

app.listen(3333, () => {
  console.log('Server is running on http://localhost:3333');
});

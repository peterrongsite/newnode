const express = require('express');
const app = express();
const qrcode = require('qrcode');
const axios = require('axios');
const { Client } = require('whatsapp-web.js');
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const mysql = require('mysql2');

const apiInstance = axios.create({
  baseURL: 'https://pay.maxp254.co.ke'
});

const clients = {}; // Define the 'clients' object

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'nodeapp'
});

// Connect to the MySQL database
connection.connect((error) => {
  if (error) {
    console.error('Error connecting to the database:', error);
    return;
  }
  console.log('Connected to the database');
});

// Retrieve device IDs from the database
const query = 'SELECT device FROM devices';
connection.query(query, (error, results) => {
  if (error) {
    console.error('Error retrieving device IDs:', error);
    return;
  }
  const devicees = results.map((row) => row.device);
  console.log('Retrieved device IDs:', devicees);

  // Create clients for each device
  devicees.forEach((deviceId) => {
    createClient(deviceId);
  });
});

// Rest of your code...


app.post('/:deviceId/send-message',  express.json(), (req, res) => {
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

  // Update the device status to 1 in the database
  const updateQuery = 'UPDATE devices SET status = 1 WHERE device = ?';
  connection.query(updateQuery, [deviceId], (error, results) => {
    if (error) {
      console.error('Error updating device status:', error);
      // Handle the error accordingly
    }
    console.log(`Device ${deviceId} status updated to 1`);
  });
});

client.on('message', async (msg) => {
  const phoneNumber = msg.from;
  const senderName = msg._data.notifyName;
  const message = msg.body;
  console.log('Received message:');
  console.log('Phone Number:', phoneNumber);
  console.log('Sender Name:', senderName);
  console.log('Message:', message);

  // Filter messages from groups and broadcasts
  if (msg.isGroupMsg || msg.isBroadcast) {
    console.log('Message filtered: Not processing messages from groups or broadcasts.');
    return; // Skip further processing for these messages
  }

  let mediaUrl = null; // Initialize mediaUrl as null

  if (msg.hasMedia) {
    const mediaData = await msg.downloadMedia();

    // Save the media to a file
    const fileName = `${Date.now()}.${mediaData.mimetype.split('/')[1]}`;
    const filePath = `uploads/${fileName}`;
    fs.writeFileSync(filePath, mediaData.data, 'base64');
    console.log('Media saved:', fileName);

    // Set mediaUrl if media is present
    mediaUrl = `http://localhost/node/${filePath}`;
  }

  // Send webhook data
  try {
    await axios.post('http://localhost/node/webhook.php', {
      phoneNumber: phoneNumber,
      senderName: senderName,
      message: message,
      mediaUrl: mediaUrl // Include mediaUrl in the payload
    });
  } catch (error) {
    console.error('Error sending webhook:', error);
  }
});
  
client.on('disconnected', (reason) => {
  console.log(`Device ${deviceId} disconnected. Reason: ${reason}`);

  // Update the device status to 0 in the database
  const updateQuery = 'UPDATE devices SET status = 0 WHERE device = ?';
  connection.query(updateQuery, [deviceId], (error, results) => {
    if (error) {
      console.error('Error updating device status:', error);
      // Handle the error accordingly
    }
    console.log(`Device ${deviceId} status updated to 0`);
  });

  // Handle client disconnection here
  // You can take appropriate actions, such as attempting to reconnect
});

  client.initialize();
}

function resetClient(deviceId) {
  const client = clients[deviceId]?.client;
  if (client) {
    const browser = client.pupBrowser;
    if (browser) {
      client.destroy()
        .then(() => {
          client.initialize(); // Initialize a new client instance
        })
        .catch((error) => {
          console.error(`Error occurred during client destruction: ${error}`);
        });
    } else {
      console.log(`No browser instance found for deviceId: ${deviceId}`);
    }
  } else {
    console.log(`No client found for deviceId: ${deviceId}`);
  }
}

 

app.listen(3333, () => {
  console.log('Server is running on http://localhost:3333');
});

const qrcode = require('qrcode-terminal');
const mysql = require('mysql2');
const { Client } = require('whatsapp-web.js');
const fs = require('fs');
// Path where the session data will be stored
const SESSION_FILE_PATH = './session.json';


const client = new Client();

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
  console.log('Client is ready!');
});




const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'nodeapp'
});

client.on('message', async (message) => {
  const { body, from } = message;

 
  // Extract the phone number without @c.us suffix
  const phone = from.split('@')[0];
  
  // Check if the message is from a broadcast
  if (phone.includes('status')) {
    // console.log('Ignoring message from broadcast');
    return;
  }
 
  const receivedMessage = body;
  const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

  connection.query(`SELECT COUNT(*) as count FROM ussd WHERE mobile = '${phone}'`, (error, results, fields) => {
    if (error) {
      console.error('Error executing query: ', error);
      return;
    }

    const nr3 = results[0].count;
    if (nr3 === 1) {
      // Existing user
    //select from db to know the session
    let session = ''; // Declare the session variable outside both connection.query methods

    connection.query(`SELECT session FROM ussd WHERE mobile = '${phone}'`, (error, results, fields) => {
      if (error) {
        console.error('Error executing query: ', error);
        return;
      }
    
      session = results[0].session; // Update the session variable inside the callback
    
      //console.log(session);
    
      if (session === 'replied' && receivedMessage === '1') {
        // Rest of your code for buying airtime
        let response = `Please select the network you want to buy airtime\n`;
        response += `1. Safaricom\n`;
        response += `2. Airtel\n`;
        response += `3. Telkom\n`
        
        const query = `UPDATE ussd SET session = 'airtime' WHERE mobile='${phone}'`;

        connection.query(query, (error, results, fields) => {
          if (error) {
            console.error('Error executing query: ', error);
            return;
          }
      
        
        });
      
        connection.end();
        
        client.sendMessage(from, response)

      } else if (session === 'airtime' && receivedMessage === '1') {
        //safaricom airtime
        // ...

        let response = `Please enter the number you want to buy airtime for\n`;
        
        const query = `UPDATE ussd SET session = 'safbuyfor' WHERE mobile='${phone}'`;

        connection.query(query, (error, results, fields) => {
          if (error) {
            console.error('Error executing query: ', error);
            return;
          }
      
        
        });
      
        connection.end();
        
        message.reply(response);




      }
    });
    } 
    
    else {
      // New user

      let response = `Welcome to shopyetu, my name is Andrew and am your bot assistant today:\n\n Please select the service you want to access below \n`;
      response += `1. Buy Airtime\n`;
      response += `2. Buy Kplc tokens\n`;
      response += `3. Pay your water bills\n`

    //  const query = `UPDATE session SET session='replied' WHERE mobile='${phone}'`;

      client.sendMessage(from, response)
        .then(() => {
          // Insert the user into the database with the current time
          connection.query(`INSERT INTO ussd (mobile, session, time, type) VALUES ('${phone}', 'replied', '${currentTime}', 'airtime')`, (error, results, fields) => {
            if (error) {
              console.error('Error inserting user into the database: ', error);
            } else {
              console.log('User inserted into the database successfully!');
            }
          });
        })
        .catch((error) => {
          console.error('Error sending message: ', error);
        });
    }
  });
});

connection.connect((error) => {
  if (error) {
    console.error('Error connecting to the database: ', error);
    return;
  }

  console.log('Connected to the database!');
  client.initialize();
});


const axios = require('axios');

const postData = {
  phone: phone,
  message: receivedMessage
};

axios.post('https://pay.maxp254.co.ke/api.php', postData)
  .then(response => {
    console.log(response.data);
  })
  .catch(error => {
    console.error(error);
  });

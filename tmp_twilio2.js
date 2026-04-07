const sid = "AC29a554145647da09dbaf99df499e7532";
const token = "0d903786817067c5b2174dbaf41fb673"; // Their NEW token
const btoa = (str) => Buffer.from(str).toString('base64');
const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`;

fetch(url, {
  headers: {
    'Authorization': 'Basic ' + btoa(`${sid}:${token}`)
  }
})
.then(async res => {
   console.log("STATUS: " + res.status);
   console.log("TEXT:", await res.text());
})
.catch(err => console.error("ERR", err));

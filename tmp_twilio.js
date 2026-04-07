const sid = "AC29a554145647da09dbaf99df499e7532";
const token = "48935bd994051389195f8e572514b22c";
const btoa = (str) => Buffer.from(str).toString('base64');
const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`;

fetch(url, {
  headers: {
    'Authorization': 'Basic ' + btoa(`${sid}:${token}`)
  }
})
.then(res => res.json())
.then(data => {
   if (data.incoming_phone_numbers && data.incoming_phone_numbers.length > 0) {
       console.log("TWILIO_NUMBER:" + data.incoming_phone_numbers[0].phone_number);
   } else {
       console.log("TWILIO_NUMBER:NOT_FOUND");
   }
})
.catch(err => console.error("ERR", err));

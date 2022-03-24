/* ****************************************************************************************************
 * validate US phone number
 *
 * input:
 * . phone +12345678901 | 123445678901 | 2345678901 | 234 567 8901 | (234) 567-8901
 * returns
 * E.164
 * ****************************************************************************************************
 */
const assert = require("assert");

exports.handler = async function(context, event, callback) {
  const THIS = 'validate-phone:';

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  assert(event.phone, `Missing event.phone!!!`);

  const client = context.getTwilioClient();
  try {
    // console.log(THIS, `lookup ${event.phone}`);
    const phone = await client.lookups.v1.phoneNumbers(event.phone).fetch({countryCode: 'US'});
    assert(phone.hasOwnProperty('phoneNumber'), 'No phone.phoneNumber!!!');
    const response = new Twilio.Response();
    response.setStatusCode(200);
    response.setBody({
      phone: phone.phoneNumber
    });
    return callback(null, response);
  } catch (err) {
    console.log("ERROR", err);
    const response = new Twilio.Response();
    response.setStatusCode(400);
    response.setBody({error: err})
    return callback(null, response);
  }
}



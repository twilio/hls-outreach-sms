'use strict';
/* ****************************************************************************************************
 * validate US phone number
 *
 * input:
 * . phone +12345678901 | 123445678901 | 2345678901 | 234 567 8901 | (234) 567-8901
 * return:
 * E.164
 * ****************************************************************************************************
 */
exports.handler = async function(context, event, callback) {
  const THIS = 'validate-phone:';

  const assert = require("assert");

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  assert(event.phone, `Missing event.phone!!!`);

  const client = context.getTwilioClient();
  try {
    console.log(THIS, `looking up phone number: ${event.phone}`);
    const phone = await client.lookups.v1.phoneNumbers(event.phone).fetch({countryCode: 'US'});

    assert(phone.hasOwnProperty('phoneNumber'), 'No phone.phoneNumber!!!');
    const response = phone.phoneNumber;
    console.log(THIS, response);
    return callback(null, response);
  } catch (err) {
    console.log("ERROR", err);
    return callback(err);
  }
}



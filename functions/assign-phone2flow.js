'use strict';
/*
 * --------------------------------------------------------------------------------
 * deploys/updates/deletes studio flow specified via event.flowName.
 * This implies that there can only be ONE flow with matching friendly-name
 * within a Twilio account.
 *
 * event:
 * . flowName: friendly-name of studio flow for check
 * . action: CREATE|UPDATE|DELETE, optional
 *
 * returns:
 * - "event.action success", if successfully
 * - null, otherwise
 * --------------------------------------------------------------------------------
 */

const assert = require("assert");
exports.handler = async function (context, event, callback) {
  const THIS = 'assign-phone2flow:';

  const assert = require('assert');
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);
  const { isValidAppToken } = require(Runtime.getFunctions()["authentication-helper"].path);

  /* Following code checks that a valid token was sent with the API call */
  if (!isValidAppToken(event.token, context)) {
    const response = new Twilio.Response();
    response.appendHeader('Content-Type', 'application/json');
    response.setStatusCode(401);
    response.setBody({message: 'Invalid or expired token'});
    return callback(null, response);
  }

  console.time(THIS);
  try {
    assert(event.flowSid, 'missing event.flowSid!!!');

    const phone_number = await getParam(context, 'TWILIO_PHONE_NUMBER');
    assert(phone_number, 'missing environment variable TWILIO_PHONE_NUMBER!!!');

    const phone = await assign_phone2flow(context, phone_number, event.flowSid);
    assert(phone, `unable to assign phone to studio flow!!!`);

    console.log(THIS, `TWILIO_PHONE_NUMBER=${phone.phoneNumber} assigned to flowSid=${event.flowSid}`);

    const response = {
      flow_sid: event.flowSid,
      phone_sid: phone.sid,
    }
    return callback(null, response);

  } catch (err) {
    console.log(err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};


// --------------------------------------------------------------------------------
async function assign_phone2flow(context, phone_number, flow_sid) {
  const client = context.getTwilioClient();

  const phoneList = await client.incomingPhoneNumbers.list();
  const phone = phoneList.find(p => p.phoneNumber === phone_number);

  const flow = await client.studio.flows(flow_sid).fetch();

  if (phone) {
    await client.incomingPhoneNumbers(phone.sid).update({
      smsUrl: flow.webhookUrl
    });
  }

  return phone;
}


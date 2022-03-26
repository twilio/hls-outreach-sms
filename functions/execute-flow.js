'use strict';
/* --------------------------------------------------------------------------------
 * executes flow
 *
 * event parameters:
 * . flowSid: SID of studio flow
 * . patient: patient data to execute flow. This will be parameter for 'flow.data'
 *            of studio flow execution
 *
 * Note that the FROM attributes for studio flow exeuction will be inferred from the flow
 *
 * returns:
 * . status = 200, if studio flow execution was successful
 * . status = 400, if studio flow execution was not successful
 * --------------------------------------------------------------------------------
 */
exports.handler = async function(context, event, callback) {
  const THIS = 'execute-flow:';

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
    assert(event.patient, 'missing event.patient!!!');
    assert(event.patient.patient_phone, 'missing event.patient.patient_phone!!!');

    const client = context.getTwilioClient();

    const from_phone = await getParam(context, 'TWILIO_PHONE_NUMBER');
    const to_phone = await client.lookups.v1.phoneNumbers(event.patient.patient_phone)
      .fetch({countryCode: 'US'})
      .then(phone => phone.phoneNumber);

    client.studio.flows(event.flowSid)
      .executions
      .create({
        to: to_phone,
        from: from_phone,
        parameters: JSON.stringify(event.patient),
      })
      .then(execution => {
        console.log(THIS, `success: ${execution.sid}`);
        const response = {
          'status': 200
        }
        return callback(null, response);
      });

  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}

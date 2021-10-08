/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * executes flow
 *
 * event parameters:
 * . flowName: friendly-name of studio flow for check
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
const assert = require('assert');
const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);

exports.handler = async function(context, event, callback) {
  const THIS = 'execute-flow -';
  console.log(THIS);
  console.time(THIS);
  try {
    assert(event.flowName, 'missing event.flowName!!!');
    assert(event.patient, 'missing event.patient!!!');

    // ---------- parameters
    context.flowName = event.flowName;
    const FLOW_SID = await getParam(context, 'TWILIO_FLOW_SID');
    assert(FLOW_SID, `not found flow.friendlyName=${event.flowName}!!!`);
    const FROM_PHONE = await getParam(context, 'TWILIO_PHONE_NUMBER');

    const client = context.getTwilioClient();

    const to_phone = await client.lookups.v1.phoneNumbers(event.patient.patient_phone)
      .fetch({countryCode: 'US'})
      .then(phone => phone.phoneNumber);
    console.log(to_phone);

    client.studio.flows(FLOW_SID)
      .executions
      .create({
        to: to_phone,
        from: FROM_PHONE,
        parameters: JSON.stringify(event.patient),
      })
      .then(execution => {
        console.log(THIS, `success: ${execution.sid}`);
        response = {
          'status': 200
        }
        callback(null, response);
      });

  } catch (err) {
    console.log(THIS, err);
    callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

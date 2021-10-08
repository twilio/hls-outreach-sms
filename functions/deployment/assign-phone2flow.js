/* eslint-disable camelcase */
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
const assert = require('assert');

const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam, assignPhone2Flow } = require(path_helper);

exports.handler = async function (context, event, callback) {
  const THIS = 'deployment/assign-phone2flow:';
  console.log(THIS);
  console.time(THIS);
  try {

    assert(event.flowName, 'missing event.flowName!!!');

    context.flowName = event.flowName;
    const flow_sid = await getParam(context, 'TWILIO_FLOW_SID');

    const phone_sid = await assignPhone2Flow(context, flow_sid);

    console.log(THIS, `PHONE_NUMBER assigned to flowName=${event.flowName}`);

    const response = {
      phone_sid: phone_sid,
    }
    callback(null, response);

  } catch (err) {
    console.log(err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

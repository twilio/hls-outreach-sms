/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * checks existence of studio flow specified via event.flowName.
 * This implies that there can only be ONE flow with matching friendly-name
 * within a Twilio account.
 *
 * event:
 * . flowName: friendly-name of studio flow for check
 *
 * returns:
 * - FLOW_SID, if found
 * - NOT-DEPLOYED, if not deployed
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');
const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);
const { path } = Runtime.getFunctions()["authentication-helper"];
const { isValidAppToken } = require(path);

exports.handler = async function (context, event, callback) {
  const THIS = 'deployment/check-studio-flow -';
  console.log(THIS, event);
  console.time(THIS);

  /* Following code checks that a valid token was sent with the API call */
  if (!isValidAppToken(event.token, context)) {
    const response = new Twilio.Response();
    response.appendHeader('Content-Type', 'application/json');
    response.setStatusCode(401);
    response.setBody({message: 'Invalid or expired token'});
    return callback(null, response);
  }

  try {
    assert(event.flowName, 'missing event.flowName!!!');

    // ---------- parameters
    context.flowName = event.flowName;
    const FLOW_SID = await getParam(context, 'TWILIO_FLOW_SID');
    // FLOW_SID will be 'null' if associated flow is not found
    if (FLOW_SID) {
      callback(null, FLOW_SID);
    } else {
      callback(null, 'NOT-DEPLOYED');
    }
  } catch (err) {
    console.log(THIS, err);
    callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

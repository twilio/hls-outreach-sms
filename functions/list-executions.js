/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * list executions of studio flow specified via event.flowName
 *
 * event:
 * . flowName: friendly-name of studio flow
 *
 * returns:
 * - json array of execution SIDs, if successful
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');

const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);
const { path } = Runtime.getFunctions()["authentication-helper"];
const { isValidAppToken } = require(path);

exports.handler = async function(context, event, callback) {
  const THIS = 'list-executions -';
  console.log(THIS);
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
    if (! FLOW_SID) {
      callback(null, 'NOT-DEPLOYED');
    }

    const client = context.getTwilioClient();
    const executions = await client.studio.v2.flows(FLOW_SID).executions.list();

    const response = executions
      .filter(e => e.status === 'ended')
      .map(e => e.sid);

    return callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

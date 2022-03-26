'use strict';
/*
 * --------------------------------------------------------------------------------
 * lists friendlyName of studio flows available for this blueprint.
 *
 * flow friendlyName starts with 'Outreach'
 *
 * event:
 *
 * returns: array of { friendlyName, flow_sid }
 * --------------------------------------------------------------------------------
 */
exports.handler = async function (context, event, callback) {
  const THIS = 'list-flows:';

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
    const service_sid = await getParam(context, 'SERVICE_SID');
    assert(service_sid, 'Service not yet deployed!!!');

    const client = context.getTwilioClient();

    const allFlows = await client.studio.flows.list();
    const flows = allFlows.filter(f => f.friendlyName.startsWith('Outreach'));

    const reponse = flows.map(f => {
      return {
        friendlyName: f.friendlyName,
        flow_sid: f.sid,
      }
    });
    callback(null, reponse);

  } catch (err) {
    console.log(err);
    callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};


/* --------------------------------------------------------------------------------
 * retrieve flow_sid of input flow friendlyName
 * --------------------------------------------------------------------------------
 */
const get_flow_sid = async (context, flowFriendlyName) => {
  const client = context.getTwilioClient();

  const flows = await client.studio.flows.list();
  const flow = flows.find(f => f.friendlyName === flowFriendlyName);

  return flow ? flow.sid : null;
}

exports.get_flow_sid = get_flow_sid;

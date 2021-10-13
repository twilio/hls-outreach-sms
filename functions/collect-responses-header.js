/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * collects outreach response header of studio flow specified via event.flowName
 * & event.orientation
 *
 * event:
 * .flowName: friendly-name of studio flow
 * .orientation: ROW|COLUMN
 *
 * returns:
 * - text/csv payload, if successful
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');

const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);
const { path } = Runtime.getFunctions()["authentication-helper"];
const { isValidAppToken } = require(path);

exports.handler = async function(context, event, callback) {
  const THIS = 'collect-responses-header -';
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
    assert(event.orientation, 'missing event.orientation!!!');
    assert(['ROW', 'COLUMN'].includes(event.orientation), 'event.orientation not ROW|COLUMN!!!');

    // ---------- parameters
    context.flowName = event.flowName;
    const FLOW_SID = await getParam(context, 'TWILIO_FLOW_SID');
    // FLOW_SID will be 'null' if associated flow is not found
    if (! FLOW_SID) {
      callback(null, 'NOT-DEPLOYED');
    }

    const client = context.getTwilioClient();
    // latest flow revision is returned first
    const flow = await client.studio.v2.flows(FLOW_SID).revisions('LatestPublished').fetch();
    const question_ids = flow.definition.states
      .filter(q => q.type === 'send-and-wait-for-reply')
      .map(q => q.name);
    console.log(THIS, question_ids);

    const executions = await client.studio.v2.flows(FLOW_SID).executions.list();
    console.log(THIS, `found executions: ${executions.length}`);
    if (executions.length === 0) {
      const response = new Twilio.Response();
      response.setStatusCode(200);
      response.appendHeader('Content-Type', 'application/csv')
      response.setBody('\n');

      return callback(null, response);
    }

    const execution = executions.find(e => e.status === 'ended');
    const ec = await client.studio
      .flows(FLOW_SID)
      .executions(execution.sid)
      .executionContext()
      .fetch();

    console.log('execution_sid', execution.sid);

    let header = null;
    switch (event.orientation) {
      case 'ROW':
        header = [
          Object.keys(ec.context.flow.data).toString(),
          'response_timestamp',
          'question_id',
          'response',
        ].join(',');
        break;
      case 'COLUMN':
        header = [
          Object.keys(ec.context.flow.data).toString(),
          'response_timestamp',
          question_ids.toString()
        ].join(',');
        break;
    }

    const response = new Twilio.Response();
    response.setStatusCode(200);
    response.appendHeader('Content-Type', 'application/csv')
    response.setBody(header + '\n');

    return callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

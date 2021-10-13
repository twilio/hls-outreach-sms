/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * collects outreach responses of studio flow specified via event.flowName
 * & event.execution_sid, event.orientation
 * This implies that there can only be ONE flow with matching friendly-name
 * within a Twilio account.
 *
 * event:
 * .flowName: friendly-name of studio flow
 * .execution_sid: execution SID to collect data
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
  const THIS = 'collect-responses-data -';
  console.log(THIS, event.orientation);
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
    assert(event.execution_sid, 'missing event.execution_sid!!!');
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

    let body = '';
    switch (event.orientation) {
      case 'COLUMN':
      {
        const ec = await client.studio.v2
          .flows(FLOW_SID)
          .executions(event.execution_sid)
          .executionContext()
          .fetch();
        console.log('fetched execution:', event.execution_sid);
        let row = Object.values(ec.context.flow.data).toString();
        let response_timestamp = null;
        for (q of question_ids) {
          row += ','
          if (!ec.context.widgets[q]) continue;

          w = ec.context.widgets[q]
          if (!response_timestamp) {
            response_timestamp = w.outbound.DateCreated;
            row += `${response_timestamp},`;
          }
          row += (w.inbound ? w.inbound.Body : '');
        }
        body = row + '\n';
        console.log(body);
      }
      break;
      case 'ROW':
      {
        const ec = await client.studio.v2
          .flows(FLOW_SID)
          .executions(event.execution_sid)
          .executionContext()
          .fetch();
        console.log('fetched execution:', event.execution_sid);
        let response_timestamp = null;
        for (q of question_ids) {
          if (!ec.context.widgets[q]) continue;

          w = ec.context.widgets[q]
          const row = [
            Object.values(ec.context.flow.data).toString(),
            w.outbound.DateCreated,
            q,
            (w.inbound ? w.inbound.Body : '')
          ].join(',');
          body += row + '\n';
        }
      }
      break;
    }

    const response = new Twilio.Response();
    response.setStatusCode(200);
    response.appendHeader('Content-Type', 'application/csv')
    response.setBody(body);

    return callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

'use strict';
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
const assert = require("assert");
exports.handler = async function(context, event, callback) {
  const THIS = 'collect-responses-data:';

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
    assert(event.orientation, 'missing event.orientation!!!');
    assert(event.execution_sid, 'missing event.execution_sid!!!');
    assert(['ROW', 'COLUMN'].includes(event.orientation), 'event.orientation not ROW|COLUMN!!!');

    const client = context.getTwilioClient();
    // latest flow revision is returned first
    const flow = await client.studio.flows(event.flowSid).revisions('LatestPublished').fetch();
    const question_ids = flow.definition.states
      .filter(q => q.type === 'send-and-wait-for-reply')
      .map(q => q.name);

    const ec = await client.studio
      .flows(event.flowSid)
      .executions(event.execution_sid)
      .executionContext()
      .fetch();
    console.log(THIS, `execution=${event.execution_sid}`);

    let body = '';
    switch (event.orientation) {
      case 'COLUMN':
      {
        let row = Object.values(ec.context.flow.data).toString();
        let response_timestamp = null;
        for (const q of question_ids) {
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
        for (const q of question_ids) {
          if (!ec.context.widgets[q]) continue;

          const w = ec.context.widgets[q]
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

'use strict';
/*
 * --------------------------------------------------------------------------------
 * collects outreach response header of studio flow specified via event.flowName
 * & event.orientation
 *
 * event:
 * . flowSid: SID of studio flow
 * .orientation: ROW|COLUMN
 *
 * returns:
 * - text/csv payload, if successful
 * --------------------------------------------------------------------------------
 */
exports.handler = async function(context, event, callback) {
  const THIS = 'collect-responses-header -';

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
    assert(['ROW', 'COLUMN'].includes(event.orientation), 'event.orientation not ROW|COLUMN!!!');

    const client = context.getTwilioClient();
    // latest flow revision is returned first
    const flow = await client.studio.flows(event.flowSid).revisions('LatestPublished').fetch();
    const question_ids = flow.definition.states
      .filter(q => q.type === 'send-and-wait-for-reply')
      .map(q => q.name);
    console.log(THIS, question_ids);

    const executions = await client.studio.flows(event.flowSid).executions.list();
    console.log(THIS, `found executions: ${executions.length}`);
    if (executions.length === 0) {
      const response = new Twilio.Response();
      response.setStatusCode(200);
      response.appendHeader('Content-Type', 'application/csv');
      response.setBody('\n');

      return callback(null, response);
    }

    const execution = executions.find(e => e.status === 'ended');
    const ec = await client.studio
      .flows(event.flowSid)
      .executions(execution.sid)
      .executionContext()
      .fetch();

    console.log(THIS, `execution_sid=${execution.sid}`);

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

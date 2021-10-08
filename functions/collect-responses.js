/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * collects outreach responses of studio flow specified via event.flowName
 * This implies that there can only be ONE flow with matching friendly-name
 * within a Twilio account.
 *
 * event:
 * . flowName: friendly-name of studio flow
 *
 * returns:
 * - text/csv payload, if successful
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');

const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);

exports.handler = async function(context, event, callback) {
  const THIS = 'collect-responses -';
  console.log(THIS);
  console.time(THIS);
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

    console.log(THIS, `found executions: ${executions.length}`);
    if (executions.length === 0) {
      const response = new Twilio.Response();
      response.setStatusCode(200);
      response.appendHeader('Content-Type', 'application/csv')
      // TODO: put headres from flow.data here
      response.setBody('');

      callback(null, response);
      return;
    }

    let body = [];
    let patient = null;
    for (e of executions) {
      if (e.status !== 'ended') continue;
      console.timeLog(THIS);
      await client.studio
        .flows(FLOW_SID)
        .executions(e.sid)
        .executionContext()
        .fetch()
        .then((ec) => {
          if (body.length === 0) {
            const headers = Object.keys(ec.context.flow.data).toString() + ',question_id,response,response_timestamp\n';
            console.log(THIS, headers);
            body.push(headers);
            patient = Object.values(ec.context.flow.data).toString();
          }
          for (q of Object.keys(ec.context.widgets)) {
            console.log(THIS, q);

            w = ec.context.widgets[q]

            console.log(w);
            if (Object.keys(w).length === 0) continue;

            console.log(THIS, w.outbound.DateCreated);
            console.log(THIS, w.inbound ? w.inbound.Body : '');
          }
          body.push(patient + ',Q,Yes,2021-10-08T03:37:36Z\n');
        });
    }
    const response = new Twilio.Response();
    response.setStatusCode(200);
    response.appendHeader('Content-Type', 'application/csv')
    console.log(THIS, body.toString());
    response.setBody(body.toString());

    callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

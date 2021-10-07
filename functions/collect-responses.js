/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * downloads outreach responses of studio flow specified via event.flowName
 * This implies that there can only be ONE flow with matching friendly-name
 * within a Twilio account.
 *
 * event:
 * . flowName: friendly-name of studio flow
 *
 * returns:
 * - csv payload, if successful
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');
const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);

exports.handler = async function(context, event, callback) {
  const THIS = 'deployment/check-studio-flow -';
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
    await client.studio.v2
      .flows(FLOW_SID)
      .executions.list()
      .then(executions => {
          console.log(`found executions: ${executions.length}`);
          if (executions.length > 0) {
            const endedExecutions = executions.filter((e) => e.status === 'ended');
            for (let i = 0; i < endedExecutions.length; i++) {
              const e = endedExecutions[i];
              Twilio.studio
                .flows(flowSID)
                .executions(e.sid)
                .executionContext()
                .fetch()
                .then((ec) => {
                  console.log('----- context');
                  console.log(ec.context);
                  console.log('----- context.wdigets');
                  console.log(ec.context.widgets);
                });
            }
          }
        }
      );

    const response = new Twilio.Response();
    response.setStatusCode(200);
    response.appendHeader('Content-Type', 'application/csv')
    response.setBody("1,2,3");

    callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

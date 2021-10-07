/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * executes flow
 *
 * event parameters:
 * . flowName: friendly-name of studio flow for check
 * . patient: patient data to execute flow. This will be parameter for 'flow.data'
 *            of studio flow execution
 *
 * Note that the FROM attributes for studio flow exeuction will be inferred from the flow
 *
 * returns:
 * . status = 200, if studio flow execution was successful
 * . status = 400, if studio flow execution was not successful
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');
const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);

exports.handler = async function(context, event, callback) {
  const THIS = 'execute-flow -';
  console.log(THIS);
  console.time(THIS);
  try {
    assert(event.flowName, 'missing event.flowName!!!');

    // ---------- parameters
    context.flowName = event.flowName;
    const FLOW_SID = await getParam(context, 'TWILIO_FLOW_SID');
    // FLOW_SID will be 'null' if associated flow is not found

    response = {
      'status': 200
    }
    callback(null, response);
  } catch (err) {
    console.log(THIS, err);
    callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

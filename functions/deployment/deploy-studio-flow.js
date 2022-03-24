/* eslint-disable camelcase */
const THIS = 'deployment/deploy-studio-flow:';
/*
 * --------------------------------------------------------------------------------
 * deploys/updates/deletes studio flow specified via event.flowName.
 * This implies that there can only be ONE flow with matching friendly-name
 * within a Twilio account.
 *
 * event:
 * . flowName: friendly-name of studio flow for check
 * . action: CREATE|UPDATE|DELETE, optional
 *
 * returns:
 * - "event.action success", if successfully
 * - null, otherwise
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');
const fs = require('fs');

const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);
const { path } = Runtime.getFunctions()["authentication-helper"];
const { isValidAppToken } = require(path);

exports.handler = async function (context, event, callback) {
  const THIS = 'deployment/deploy-studio-flow -';
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
    const FLOW_SID           = await getParam(context, 'TWILIO_FLOW_SID');
    const CUSTOMER_NAME      = await getParam(context, 'CUSTOMER_NAME');
    const APPLICATION_NAME   = await getParam(context, 'APPLICATION_NAME');
    const PHONE_NUMBER       = await getParam(context, 'TWILIO_PHONE_NUMBER');
    const SERVICE_SID        = await getParam(context, 'SERVICE_SID');
    const ENVIRONMENT_SID    = await getParam(context, 'ENVIRONMENT_SID');
    const ENVIRONMENT_DOMAIN = await getParam(context, 'ENVIRONMENT_DOMAIN');

    // ---------- load & configure studio flow definition
    console.log(THIS, 'Replacing YOUR_HEALTH_SYSTEM_NAME        ->', CUSTOMER_NAME);
    console.log(THIS, 'Replacing YOUR_SERVICE_SID        ->', SERVICE_SID);
    console.log(THIS, 'Replacing YOUR_ENVIRONMENT_SID    ->', ENVIRONMENT_SID);
    console.log(THIS, 'Replacing YOUR_TWILIO_ENVIRONMENT_DOMAIN ->', ENVIRONMENT_DOMAIN);

    const assetName = `/flow-${event.flowName}.template.json`;
    const flow_definition_file = Runtime.getAssets()[assetName].path;
    let flow_definition = fs
      .readFileSync(flow_definition_file)
      .toString('utf-8')
      .replace('YOUR_HEALTH_SYSTEM_NAME', CUSTOMER_NAME)
      .replace(/YOUR_SERVICE_SID/g, SERVICE_SID)
      .replace(/YOUR_ENVIRONMENT_SID/g, ENVIRONMENT_SID)
      .replace(/YOUR_TWILIO_ENVIRONMENT_DOMAIN/g, ENVIRONMENT_DOMAIN);

    const client = context.getTwilioClient();
    const functions = await client.serverless
      .services(SERVICE_SID)
      .functions.list();
    functions.forEach(function (f) {
      const fname = `YOUR_FUNCTION_SID[${f.friendlyName.replace('/', '')}]`;
      console.log(THIS, 'Replacing function', fname, '->', f.sid);
      flow_definition = flow_definition.replace(fname, f.sid);
    });

    // ---------- update/create/delete studio flow
    let action = null;
    if (event.action && event.action === 'DELETE') {
      action = 'DELETE';
    } else if (FLOW_SID && FLOW_SID.startsWith('FW')) {
      action = 'UPDATE';
    } else {
      action = 'CREATE';
    }

    switch (action) {
      case 'UPDATE':
        {
          console.log(THIS, 'Updating flow FLOW_SID=', FLOW_SID);
          const flow = await client.studio.flows(FLOW_SID).update({
            friendlyName: event.flowName,
            status: 'published',
            commitMessage: 'Manually triggered update',
            definition: `${flow_definition}`,
          });

          console.log(THIS, 'PHONE_NUMBER=', PHONE_NUMBER);

          const phoneList = await client.incomingPhoneNumbers.list();
          const phone = phoneList.find(p => p.phoneNumber === PHONE_NUMBER);
          assert(phone, `Phone number ${PHONE_NUMBER} not found!!!`);
          console.log(THIS, 'PHONE_NUMBER_SID=', phone.sid);

          await client.incomingPhoneNumbers(phone.sid).update({
            smsUrl: flow.webhookUrl
          });
          console.log(THIS, 'PHONE_NUMBER assigned to flow');
        }
        return callback(null, `${action} success`);
        break;

      case 'CREATE':
        {
          console.log(THIS, 'Creating flow');
          const flow = await client.studio.flows.create({
            friendlyName: event.flowName,
            status: 'published',
            commitMessage: 'Code Exchange automatic deploy',
            definition: `${flow_definition}`,
          });

          console.log(THIS, 'PHONE_NUMBER=', PHONE_NUMBER);

          const phoneList = await client.incomingPhoneNumbers.list();
          const phone = phoneList.find(p => p.phoneNumber === PHONE_NUMBER);
          assert(phone, `Phone number ${PHONE_NUMBER} not found!!!`);
          console.log(THIS, 'PHONE_NUMBER_SID=', phone.sid);

          await client.incomingPhoneNumbers(phone.sid).update({
            smsUrl: flow.webhookUrl
          });
          console.log(THIS, 'PHONE_NUMBER assigned to flow');
        }
        return callback(null, `${action} success`);
        break;

      case 'DELETE':
        console.log(THIS, 'Deleting FLOW_SID=', FLOW_SID);
        await client.studio.flows(FLOW_SID).remove();
        return callback(null, `${action} success`);
        break;

      default:
        return callback('undefined action!');
        break;
    }

  } catch (err) {
    console.log(err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

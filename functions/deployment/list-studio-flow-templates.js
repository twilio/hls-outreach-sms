/* eslint-disable camelcase */
/*
 * --------------------------------------------------------------------------------
 * lists friendlyName of studio flows available for this blueprint.
 *
 * flow friendlyName is determined based on available 'assets'
 * that are prefixed with '/flow-'.
 * The assert name pattern is '/flow-{flow-friendlyName}.template.private.json'
 *
 * event:
 * . n/a
 *
 * returns:
 * - json array of flow friendlyName
 * --------------------------------------------------------------------------------
 */
const assert = require('assert');
const path_helper = Runtime.getFunctions()['helpers'].path;
const { getParam } = require(path_helper);
const { path } = Runtime.getFunctions()["authentication-helper"];
const { isValidAppToken } = require(path);

exports.handler = async function (context, event, callback) {
  const THIS = 'deployment/list-studio-flow-templates:';
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
    const SERVICE_SID = await getParam(context, 'SERVICE_SID');
    assert(SERVICE_SID, 'Service not yet deployed!!!');

    const client = context.getTwilioClient();
    const assetList = await client.serverless.services(SERVICE_SID).assets.list();
    const flowNames = [];
    assetList.forEach(a => {
      if (a.friendlyName.startsWith('/flow-')) {
        console.log('found asset.friendlyName:', a.friendlyName);
        // Note that when private asset is deployed '.private' is stripped
        flowNames.push(a.friendlyName.replace('/flow-', '').replace('.template.json', ''));
      }
    });
    console.log(flowNames);
    callback(null, flowNames);

  } catch (err) {
    console.log(err);
    callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

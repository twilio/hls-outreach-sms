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

exports.handler = async function (context, event, callback) {
  const THIS = 'deployment/list-studio-flow-templates:';
  console.log(THIS);
  console.time(THIS);
  try {
    const SERVICE_SID = await getParam(context, 'TWILIO_SERVICE_SID');
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

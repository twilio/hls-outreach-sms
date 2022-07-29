'use strict';
/*
 * --------------------------------------------------------------------------------
 * checks deployment status of deployables of this application in the target Twilio account
 *
 * NOTE: that this function can only be run on localhost
 *
 * return json object that at least has the following:
 * {
 *   deploy_state: DEPLOYED|NOT-DEPLOYED
 * }
 * --------------------------------------------------------------------------------
 */
exports.handler = async function (context, event, callback) {
  const THIS = 'check:';

  const assert = require("assert");
  const { getParam, fetchVersionToDeploy } = require(Runtime.getFunctions()['helpers'].path);

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  console.time(THIS);
  try {

    // ---------- check service ----------------------------------------
    const service_sid        = await getParam(context, 'SERVICE_SID');
    const environment_domain = service_sid ? await getParam(context, 'ENVIRONMENT_DOMAIN') : null;
    const application_url    = service_sid ? `https:/${environment_domain}/index.html` : null;
    const template_flows     = await check_studio_flow_templates(context);

    const response = {
      deploy_state: (service_sid) ? 'DEPLOYED' : 'NOT-DEPLOYED',
      version: {
        deployed : application_version,
        to_deploy: await fetchVersionToDeploy(),
      },
      service_sid: service_sid,
      application_url: application_url,
      template_flows: template_flows,
    };
    console.log(THIS, response);
    return callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}


/* --------------------------------------------------------------------------------
 * checks deployment of studio flow template shipped with this application
 * --------------------------------------------------------------------------------
 */
const check_studio_flow_templates = async (context) => {
  const client = context.getTwilioClient();

  const assets = Runtime.getAssets(); // private assets only
  const flowsDeployed = await client.studio.flows.list();
  const templatesDeployed = [];
  for (const aName of Object.keys(assets)) {
    if (! aName.startsWith('/flow-')) continue; // skip non studio flow template
    const tName = aName.replace('/flow-', '').replace('.template.json', '');

    let flow = flowsDeployed.find(f => f.friendlyName === tName);

    templatesDeployed.push({
      asset       : aName,
      friendlyName: flow ? flow.friendlyName : tName,
      sid         : flow ? flow.sid : null,
    })
  }
  return templatesDeployed;
}

exports.check_studio_flow_templates = check_studio_flow_templates;

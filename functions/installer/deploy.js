'use strict';
/* --------------------------------------------------------------------------------
 * deploys application (service) to target Twilio account.
 *
 * NOTE: that this function can only be run on localhost
 *
 * input:
 * event.action: CREATE|UPDATE|DELETE, defaults to CREATE|UPDATE depending on deployed state
 *
 * service identified via unique_name = APPLICATION_NAME in helpers.private.js
 * --------------------------------------------------------------------------------
 */
exports.handler = async function(context, event, callback) {
  const THIS = 'deploy:';

  const assert = require("assert");
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  console.time(THIS);
  try {
    assert(event.configuration.APPLICATION_NAME, 'missing APPLICATION_NAME variable!!!');
    assert(event.action, 'missing event.action variable!!!');
    const application_name = event.configuration.APPLICATION_NAME;
    const env = event.configuration;
    console.log(THIS, 'configuration submitted:\n', env);

    console.log(THIS, `Deploying (${event.action}) Twilio service ... ${application_name}`);

    switch (event.action) {

      case 'DEPLOY':
      case 'REDEPLOY': {
        const service_sid = await deploy_service(context, env);
        console.log(THIS, `Deployed: ${service_sid}`);

        console.log(THIS, 'Provisioning dependent Twilio services');
        await getParam(context, 'VERIFY_SID');

        console.log(THIS, 'Make Twilio service editable ...');
        const client = context.getTwilioClient();
        await client.serverless.services(service_sid).update({uiEditable: true});

        const templates = await deploy_studio_flow_templates(context);
        console.log(THIS, `deployed ${templates.length} studio flow template(s)`);

        console.log(THIS, `Completed deployment of ${application_name}`);

        const response = {
          status: event.action,
          deployables: [
            { service_sid: service_sid, },
            { studio_flow_temapltes: templates, },
          ],
        };
        console.log(THIS, response);
        return callback(null, response);
      }
        break;

      case 'UNDEPLOY': {
        const undeployed_service_sid = await undeploy_service(context);

        // TODO: un-provision other services

        const response = {
          status: 'UNDEPLOYED',
          deployables: [
            { service_sid: undeployed_service_sid, },
          ],
        };
        console.log(THIS, response);
        return callback(null, response);
      }
        break;

      default: throw new Error(`unknown event.action=${action}`);
    }

  } catch(err) {
    console.log(err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}


/* --------------------------------------------------------------------------------
 * deploys (creates new/updates existing) service to target Twilio account.
 *
 * - service identified via unique_name = APPLICATION_NAME in helpers.private.js
 *
 * returns: service SID, if successful
 * --------------------------------------------------------------------------------
 */
async function get_assets() {
  const { getListOfFunctionsAndAssets } = require('@twilio-labs/serverless-api/dist/utils/fs');

  const { assets } = await getListOfFunctionsAndAssets(process.cwd(), {
    functionsFolderNames: [],
    assetsFolderNames: ["assets"],
  });
  //console.log('asset count:', assets.length);

  const indexHTMLs = assets.filter(asset => asset.name.includes('index.html'));
  // Set indext.html as a default document
  const allAssets = assets.concat(indexHTMLs.map(ih => ({
    ...ih,
    path: ih.name.replace("index.html", ""),
    name: ih.name.replace("index.html", ""),
  })));
  //console.log(allAssets);
  //return allAssets;
  return assets;
}


/* --------------------------------------------------------------------------------
 * deploys serverless service
 * --------------------------------------------------------------------------------
 */
async function deploy_service(context, envrionmentVariables = {}) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);
  const { getListOfFunctionsAndAssets } = require('@twilio-labs/serverless-api/dist/utils/fs');
  const { TwilioServerlessApiClient } = require('@twilio-labs/serverless-api');
  const fs = require('fs');

  const client = context.getTwilioClient();

  const assets = await get_assets();
  console.log('asset count:' , assets.length);

  const { functions } = await getListOfFunctionsAndAssets(process.cwd(),{
    functionsFolderNames: ["functions"],
    assetsFolderNames: []
  });
  console.log('function count:' , functions.length);

  const pkgJsonRaw = fs.readFileSync(`${process.cwd()}/package.json`);
  const pkgJsonInfo = JSON.parse(pkgJsonRaw);
  const dependencies = pkgJsonInfo.dependencies;
  console.log('package.json loaded');

  const deployOptions = {
    env: {
      ...envrionmentVariables
    },
    pkgJson: {
      dependencies,
    },
    functionsEnv: 'dev',
    functions,
    assets,
  };
  console.log('deployOptions.env:', deployOptions.env);

  context['APPLICATION_NAME'] = envrionmentVariables.APPLICATION_NAME;
  let service_sid = await getParam(context, 'SERVICE_SID');
  if (service_sid) {
    // update service
    console.log('updating services ...');
    deployOptions.serviceSid = service_sid;
  } else {
    // create service
    console.log('creating services ...');
    deployOptions.serviceName = await getParam(context, 'APPLICATION_NAME');
  }

  const serverlessClient = new TwilioServerlessApiClient({
    username: client.username, // ACCOUNT_SID
    password: client.password, // AUTH_TOKEN
  });

  serverlessClient.on("status-update", evt => {
    console.log(evt.message);
  });

  await serverlessClient.deployProject(deployOptions);
  service_sid = await getParam(context, 'SERVICE_SID');

  return service_sid;
}


/* --------------------------------------------------------------------------------
 * undeploys sererless service
 * --------------------------------------------------------------------------------
 */
async function undeploy_service(context) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  const client = context.getTwilioClient();
  // ---------- remove studio flow, if exists
  const service_sid = await getParam(context, 'SERVICE_SID'); // will be null if not deployed
  if (service_sid) {
    const response = await client.serverless.services(service_sid).remove();
  }

  return service_sid;
}


/* --------------------------------------------------------------------------------
 * deploys studio flow template shipped with this application
 * --------------------------------------------------------------------------------
 */
async function deploy_studio_flow_templates (context) {
  const { check_studio_flow_templates }  = require(Runtime.getFunctions()['installer/check'].path);

  const deployed = await check_studio_flow_templates(context);
  const toDeploy = deployed.filter(t => t.sid === null);
  for(const t of toDeploy) {
    const asset = Runtime.getAssets()[t.asset]
    const flowDefinition = asset.open();
    const flow = await deploy_studio_flow(context,  t.friendlyName,  flowDefinition);
    t.sid = flow.sid;
  }

  return toDeploy;
}


/* --------------------------------------------------------------------------------
 * deploys studio flow
 * . create/update studio flow
 * --------------------------------------------------------------------------------
 */
const deploy_studio_flow = async (context, flowName, flowDefinition) => {
  const assert = require("assert");

  const client = context.getTwilioClient();
  // ---------- validate studio flow definition
  const flowValid = await client.studio.flowValidate.update({
    friendlyName: flowName,
    status: 'published',
    definition: `${flowDefinition}`,
  });
  assert(flowValid.valid, `invalid flow definitio for flow=${flowName}!!!`);

  // ---------- deploy studio flow
  const flowsDeployed = await client.studio.flows.list();

  const flowDeployed = flowsDeployed.find(f => f.friendlyName === flowName);
  const flow = flowDeployed
    ? await client.studio.flows(flowDeployed.sid).update({
      status: 'published',
      commitMessage: 'installer deployed',
      definition: `${flowDefinition}`,
    })
    : await client.studio.flows.create({
      friendlyName: flowName,
      status: 'published',
      commitMessage: 'installer deployed',
      definition: `${flowDefinition}`,
    });

  return flow;
}

exports.deploy_studio_flow = deploy_studio_flow;


/* --------------------------------------------------------------------------------
 * undeploys studio flow
 * --------------------------------------------------------------------------------
 */
const undeploy_studio_flow = async (context, flowSID) => {
  const client = context.getTwilioClient();
  // ---------- remove studio flow, if exists
  const flow = await client.studio.v2.flows(flowSID).remove();

  return flow;
}

exports.undeploy_studio_flow = undeploy_studio_flow;

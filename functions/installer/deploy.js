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
const assert = require("assert");
const { getParam, getAllParams } = require(Runtime.getFunctions()['helpers'].path);
const { TwilioServerlessApiClient } = require('@twilio-labs/serverless-api');
const { getListOfFunctionsAndAssets } = require('@twilio-labs/serverless-api/dist/utils/fs');
const fs = require('fs');
const { execSync } = require('child_process');


exports.handler = async function(context, event, callback) {
  const THIS = 'deploy:';

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
        const service_sid = await deployService(context, env);
        console.log(THIS, `Deployed: ${service_sid}`);

        console.log(THIS, 'Make Twilio service editable ...');
        const client = context.getTwilioClient();
        await client.serverless.services(service_sid).update({uiEditable: true});

//        console.log(THIS, 'Provisioning dependent Twilio services');
//        const params = await getAllParams(context);
        //console.log(THIS, params);

//        const studio_flow_sid = await deployStudioFlow(context);
//        console.log(THIS, 'deployed Studio flow');

        console.log(THIS, `Completed deployment of ${application_name}`);

        const response = {
          status: event.action,
          deployables: [
            { service_sid: service_sid, },
//            { studio_flow_id: studio_flow_sid, },
          ],
        };
        console.log(THIS, response);
        return callback(null, response);
      }
        break;

      case 'UNDEPLOY': {
        const undeployed_service_sid = await undeployService(context);

//        const undeployed_studio_flow_sid = await undeployStudioFlow(context);

        // TODO: un-provision other services

        const response = {
          status: 'UNDEPLOYED',
          deployables: [
            { service_sid: undeployed_service_sid, },
//            { studio_flow_id: undeployed_studio_flow_sid, },
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
async function getAssets() {
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
async function deployService(context, envrionmentVariables = {}) {
  const THIS = 'deployService:';
  const client = context.getTwilioClient();

  const assets = await getAssets();
  console.log(THIS, 'asset count:' , assets.length);

  const { functions } = await getListOfFunctionsAndAssets(process.cwd(),{
    functionsFolderNames: ["functions"],
    assetsFolderNames: []
  });
  console.log(THIS, 'function count:' , functions.length);

  const pkgJsonRaw = fs.readFileSync(`${process.cwd()}/package.json`);
  const pkgJsonInfo = JSON.parse(pkgJsonRaw);
  const dependencies = pkgJsonInfo.dependencies;
  console.log(THIS, 'package.json loaded');

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
  console.log(THIS, 'deployOptions.env:', deployOptions.env);

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
async function undeployService(context) {
  const THIS = 'undeployService:';
  try {
    const client = context.getTwilioClient();
    // ---------- remove studio flow, if exists
    const service_sid = await getParam(context, 'SERVICE_SID'); // will be null if not deployed
    if (service_sid) {
      const response = await client.serverless.services(service_sid).remove();
      console.log(THIS, 'undeploy: ', response);
    }

    return service_sid;

  } catch (err) {
    console.log(THIS, err);
    throw new Error(err);
  }
}

/* --------------------------------------------------------------------------------
 * deploys studio flow
 * . create/update studio flow
 * . set flex flow integration for webchat
 * --------------------------------------------------------------------------------
 */
async function deployStudioFlow(context) {
  const THIS = 'deployStudioFlow:';

  try {
    const SERVICE_SID           = await getParam(context, 'SERVICE_SID');
    const FUNCTION_SID          = await getParam(context, 'FUNCTION_SID');
    const ENVIRONMENT_SID       = await getParam(context, 'ENVIRONMENT_SID');
    const ENVIRONMENT_DOMAIN    = await getParam(context, 'ENVIRONMENT_DOMAIN');
    const FLEX_WORKFLOW_SID     = await getParam(context, 'FLEX_WORKFLOW_SID');
    const FLEX_TASK_CHANNEL_SID = await getParam(context, 'FLEX_TASK_CHANNEL_SID');
    const STUDIO_FLOW_NAME      = await getParam(context, 'STUDIO_FLOW_NAME');
    let   STUDIO_FLOW_SID       = await getParam(context, 'STUDIO_FLOW_SID'); // will be null if not deployed

    const flow_definition_file = Runtime.getAssets()['/installer/studio-flow-template.json'].path;
    let flow_definition = fs.readFileSync(flow_definition_file).toString('utf-8')
      .replace(/YOUR_SERVICE_SID/g, SERVICE_SID)
      .replace(/YOUR_FUNCTION_SID/g, FUNCTION_SID)
      .replace(/YOUR_ENVIRONMENT_SID/g, ENVIRONMENT_SID)
      .replace(/YOUR_ENVIRONMENT_DOMAIN/g, ENVIRONMENT_DOMAIN)
      .replace(/YOUR_FLEX_WORKFLOW_SID/g, FLEX_WORKFLOW_SID)
      .replace(/YOUR_FLEX_TASK_CHANNEL_SID/g, FLEX_TASK_CHANNEL_SID);

    const client = context.getTwilioClient();
    // ---------- create/update studio flow
    const flow = (STUDIO_FLOW_SID)
      ? await client.studio.flows(STUDIO_FLOW_SID).update({
        status: 'published',
        commitMessage: 'installer deploy update',
        definition: `${flow_definition}`,
      })
      : await client.studio.flows.create({
        friendlyName: STUDIO_FLOW_NAME,
        status: 'published',
        commitMessage: 'installer deploy create',
        definition: `${flow_definition}`,
      });
    STUDIO_FLOW_SID = flow.sid;

    // ---------- update flex flow for webchat with studio flow
    const FLEX_WEB_FLOW_SID = await getParam(context, 'FLEX_WEB_FLOW_SID');
    await client.flexApi.v1.flexFlow(FLEX_WEB_FLOW_SID)
      .update({
        integrationType: 'studio',
        integration: {
          retryCount: 3,
          flowSid: STUDIO_FLOW_SID,
        }
      });

    return STUDIO_FLOW_SID;

  } catch (err) {
    console.log(THIS, err);
    throw new Error(err);
  } finally {
    console.log(THIS, 'sucess');
  }
}

/* --------------------------------------------------------------------------------
 * undeploys studio flow
 * --------------------------------------------------------------------------------
 */
async function undeployStudioFlow(context) {
  const THIS = 'undeployStudioFlow:';
  try {
    const client = context.getTwilioClient();
    // ---------- remove studio flow, if exists
    const STUDIO_FLOW_SID = await getParam(context, 'STUDIO_FLOW_SID'); // will be null if not deployed
    if (STUDIO_FLOW_SID) {
      const response = await client.studio.v1.flows(STUDIO_FLOW_SID).remove();
      console.log(THIS, 'undeploy: ', response);
    }

    // ---------- TODO: clear flex flow integration settings
    const FLEX_WEB_FLOW_SID = await getParam(context, 'FLEX_WEB_FLOW_SID');

    return STUDIO_FLOW_SID;

  } catch (err) {
    console.log(THIS, err);
    throw new Error(err);
  }
}

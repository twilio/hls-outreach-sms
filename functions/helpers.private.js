/* ----------------------------------------------------------------------------------------------------
 * common helper function used by functions
 *
 * parameters to specific to this application
 *
 * getParam(context, key)        : fetches parameter value from (1) context; (2) deployed service
 *   also, provisions provisionable parameters (application-specific)
 * setParam(context, key, value) : sets parameter in deployed service
 * deprovisionParams(context)    : deprovisions all provisionable parameter for this application, call from undeploy
 *
 * ----------------------------------------------------------------------------------------------------
 */
const assert = require("assert");

/* --------------------------------------------------------------------------------
 * retrieve environment variable value
 * --------------------------------------------------------------------------------
 */
async function getParam(context, key) {
  assert(context.APPLICATION_NAME, 'undefined .env environment variable APPLICATION_NAME!!!');
  assert(context.CUSTOMER_NAME, 'undefined .env environment variable CUSTOMER_NAME!!!');

  if (key !== 'SERVICE_SID' // avoid warning
    && key !== 'ENVIRONMENT_SID' // avoid warning
    && context[key]) {
    return context[key]; // first return context non-null context value
  }

  const client = context.getTwilioClient();
  switch (key) {
    case 'SERVICE_SID': // always required
    {
      const services = await client.serverless.services.list();
      const service = services.find(s => s.friendlyName === context.APPLICATION_NAME);

      // return sid only if deployed; otherwise null
      return service ? service.sid : null;
    }

    case 'ENVIRONMENT_SID': // always required
    {
      const service_sid = await getParam(context, 'SERVICE_SID');
      if (service_sid === null) return null; // service not yet deployed

      const environments = await client.serverless
        .services(service_sid)
        .environments.list({limit : 1});

      return environments.length > 0 ? environments[0].sid : null;
    }

    case 'ENVIRONMENT_DOMAIN': // always required
    {
      const service_sid = await getParam(context, 'SERVICE_SID');
      if (service_sid === null) return null; // service not yet deployed

      const environments = await client.serverless
        .services(service_sid)
        .environments.list({limit : 1});

      return environments.length > 0 ? environments[0].domainName: null;
    }

    case 'VERIFY_SID':
    {
      const services = await client.verify.services.list();
      let service = services.find(s => s.friendlyName === context.APPLICATION_NAME);
      if (! service) {
        console.log(`Verify service not found so creating a new verify service friendlyName=${context.APPLICATION_NAME}`);
        service = await client.verify.services.create({ friendlyName: context.APPLICATION_NAME });
      }
      if (! service) throw new Error('Unable to create a Twilio Verify Service!!! ABORTING!!!');

      await setParam(context, key, service.sid);
      return service.sid;
    }

    case 'STUDIO_FLOWS': {
      const all_flows = await client.studio.flows.list();
      const outreach_flows = all_flows.filter(f => f.friendlyName.startsWith('Outreach'));

      const flows = outreach_flows.map(f => ({ [f.friendlyName]: f.sid }));
      await setParam(context, key, JSON.stringify(flows));
      return JSON.stringify(flows);
    }

    case 'TWILIO_FLOW_SID':
    {
      // context.friendlyName required, returns null if not supplied
      if (! context.flowName) return null;

      const flows = await client.studio.flows.list();
      const flow = flows.find(f => f.friendlyName === context.flowName);

      return flow ? flow.sid : null;
    }

    default:
      throw new Error(`Undefined variable ${key} !!!`);
  }
}


/* --------------------------------------------------------------------------------
 * deprovision environment variable
 * --------------------------------------------------------------------------------
 */
async function deprovisionParams(context) {
  const client = context.getTwilioClient();

  const verify_sid = await getParam(context, key);
  if (!verify_sid) return; // do nothing if no value

  let verify_service = null;
  try {
    verify_service = await client.verify.services(verify_sid).fetch();
  } catch (err) {
    console.log(`no verify service SID=${verify_sid}. skpping...`);
  }
  if (verify_service) await client.verify.services(verify_sid).remove();
}


/* --------------------------------------------------------------------------------
 * sets environment variable, only if service is deployed
 * --------------------------------------------------------------------------------
 */
async function setParam(context, key, value) {
  const service_sid = await getParam(context, 'SERVICE_SID');
  if (! service_sid) return null; // do nothing is service is not deployed

  const client = context.getTwilioClient();

  const environment_sid = await getParam(context, 'ENVIRONMENT_SID');
  const variables = await client.serverless
    .services(service_sid)
    .environments(environment_sid)
    .variables.list();
  let variable = variables.find(v => v.key === key);

  if (variable) {
    // update existing variable
    if (variable.value !== value) {
      await client.serverless
        .services(service_sid)
        .environments(environment_sid)
        .variables(variable.sid)
        .update({value})
        .then((v) => console.log('setParam: updated variable', v.key));
    }
  } else {
    // create new variable
    await client.serverless
      .services(service_sid)
      .environments(environment_sid)
      .variables.create({ key, value })
      .then((v) => console.log('setParam: created variable', v.key));
  }

  context[key] = value;
  return {
    key: key,
    value: value
  };
}


// --------------------------------------------------------------------------------
module.exports = {
  getParam,
  setParam,
  deprovisionParams,
};

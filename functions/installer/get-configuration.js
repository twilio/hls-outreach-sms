'use strict';
/* --------------------------------------------------------------------------------
 * retrieves information about application:
 * - Twilio account
 * - purchased Twilio phone numbers
 * - environment variables defined in .env file
 * - current environment variable values, if service already deployed
 *
 * NOTE: that this function can only be run on localhost
 *
 * event:
 * . n/a
 *
 * returns:
 * - twilioAccountName:
 * - twilioPhoneNumbers: [ { phoneNumber, friendlyName } ]
 * - configurationVariables: [ { key, required, format, description, link, default, configurable, contentKey } ]
 *   see https://github.com/twilio-labs/configure-env/blob/main/docs/SCHEMA.md
 * - configurationValues : { key: value, ... }
 * --------------------------------------------------------------------------------
 */
exports.handler = async function (context, event, callback) {
  const THIS = 'get-configuration:';

  const assert = require("assert");
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  assert(context.ACCOUNT_SID, 'ACCOUNT_SID not set!!!');

  console.time(THIS);
  try {
    const client = context.getTwilioClient();

    const response = {}

    // ---------- account information
    {
      const account = await client.api.accounts(context.ACCOUNT_SID).fetch();

      console.log(THIS, `retrieved twilio account friendlyName=${account.friendlyName}`);
      response.twilioAccountName = account.friendlyName;
    }

    // ---------- available twilio phone numbers
    // any additional filtering of phone should be here
    {
      const phoneList = await client.api.accounts(context.ACCOUNT_SID).incomingPhoneNumbers.list();

      console.log(THIS, `retrieved ${phoneList.length} twilio phone numbers`);
      response.twilioPhoneNumbers = phoneList.map(p => {
        return {
          phoneNumber: p.phoneNumber,
          friendlyName: p.friendlyName,
        }
      });
    }

    // ---------- configuration variables
    {
      const variables = await read_configuration_variables();

      console.log(THIS, `read ${variables.length} variables`);
      response.configurationVariables = variables;
    }

    // ---------- configuration values, if service is deployed
    //            if running localhost, load local values first
    {
      const application_name = await getParam(context, 'APPLICATION_NAME');
      const service_sid = await getParam(context, 'SERVICE_SID');
      // check local variable values first, if running localhost with .env.localhost
      if (context.DOMAIN_NAME.startsWith('localhost:')) {
        const n = Object.keys(context).length;
        console.log(THIS, `retrieved ${n} variable values from localhost context`);
        // console.log(THIS, values);
        for (const variable of response.configurationVariables) {
          if (context[variable.key]) {
            variable['value'] = context[variable.key];
          }
        }
      }

      if (service_sid) {
        // check variable values from deployed service second, if service is deployed
        console.log(THIS, `found deployed service ${application_name}, retrieving variable values`);

        const environment_sid = await getParam(context, 'ENVIRONMENT_SID');
        const values = await client.serverless
          .services(service_sid)
          .environments(environment_sid)
          .variables.list();
        console.log(THIS, `retrieved ${values.length} variable values from deployed service`);
        // console.log(THIS, values);
        for (const variable of response.configurationVariables) {
          if (variable.value) continue; // skip variable value set from localhost context
          const v = values.find(e => e.key === variable.key);
          if (v) {
            variable['value'] = v.value;
          } else {
            const value = await getParam(context, variable.key);
            if (value) variable['value'] = value;
          }
        }
      }
    }

    return callback(null, response);

  } catch (err) {
    console.log(THIS, err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}

/* --------------------------------------------------------------------------------
 * read .env file content
 *
 * uses configure-env to parse .env file (https://www.npmjs.com/package/configure-env)
 * --------------------------------------------------------------------------------
 */
async function read_configuration_variables() {
  const path = require('path');
  const fs = require('fs');
  const configure_env = require('configure-env');

  const fpath = path.join(process.cwd(), '.env');
  const payload = fs.readFileSync(fpath, 'utf8');
  const configuration = configure_env.parser.parse(payload);

  return configuration.variables;
}

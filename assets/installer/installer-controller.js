
// array of user input variable values are stored here
// { key, required, css_class, value, is_valid }
const variableInput = [];

/* -----------------------------------------------------------------------------
 * page loading function
 * -----------------------------------------------------------------------------
 */
$(document).ready(async function () {
    await populate();
    checkDeployment();
});

// ---------- UI element css id list used by functions
const UI = {
  account_name: '#account_name',
  app_deployer: '#app_deployer',
  app_deployed: '#app_deployed',
  app_deploy: '#app_deploy',
  app_redeploy: '#app_redeploy',
  app_undeploy: '#app_undeploy',
  app_deploying: '#app_deploying',
  app_open: '#app_open',
  app_info: '#app_info',
  service_open: '#service_open',
}


/* -----------------------------------------------------------------------------
 * add configuration variable entry
 *
 * input:
 * - variable: see https://www.npmjs.com/package/configure-env
 */
async function addVariable(variable, currentValue = null) {
  console.log(variable.key, currentValue);

  if (variable.key === 'TWILIO_PHONE_NUMBER') {
    // twilio phone number dropdown is handled outside, TODO: move inside
    variableInput.push({
      key: 'TWILIO_PHONE_NUMBER',
      required: variable.required,
      configurable: variable.configurable,
      css_id: '#twilio_phone_number',
      value: variable.value ? variable.default : variable.value,
      isValid: true,
    });
    return;
  }

  const originalElement = $('div.clone-original');

  const clonedElement = originalElement.clone().insertBefore(originalElement);
  clonedElement.removeClass("clone-original");
  clonedElement.addClass("clone-for-" + variable.key);

  const label = variable.key.toLowerCase().split('_').map(word => word[0].toUpperCase() + word.substr(1)).join(' ');
  (variable.required === true) ? clonedElement.find('.star').show() : clonedElement.find('.star').hide();
  clonedElement.find(".configure-label").text(label);

  css_id = `${variable.key.toLowerCase()}`;
  clonedElement.find('input').attr("id", css_id);
  clonedElement.find('input').attr("name", css_id);

  const value = currentValue ? currentValue : (variable.default ? variable.default: '');
  clonedElement.find('input').val(value);
  // clonedElement.find('input').attr("placeholder", (variable.default == null ? ' ' : variable.default));
  clonedElement.find('.tooltip').text(variable.description);
  const formats = {
    "secret": "password",
    "phone_number": "text",
    "email": "text",
    "text": "text"
  };
  clonedElement.find('input').attr("type", (formats.hasOwnProperty(variable.format) ? formats[variable.format] : "text"));

  variableInput.push({
    key: variable.key,
    required: variable.required,
    configurable: variable.configurable,
    css_id: `#${css_id}`,
    value: variable.value ? variable.default : variable.value,
    isValid: true,
  });
  if (variable.configurable) {
    clonedElement.show();
    // } else {
    //     clonedElement.show();
    //     clonedElement.prop('disabled', true);
    //     clonedElement.find('input').prop('disabled', true);
    //     clonedElement.find('.configure-label').css('color','#aaaaaa');
    //     clonedElement.find('input').css('color','#aaaaaa');
  }
  // delete the original div after cloning
  //originalElement.remove();
}



// -----------------------------------------------------------------------------
async function selectPhone() {
  const selectedPhone = $('#twilio_phone_number').val();
  console.log('selected twilio phone:', selectedPhone);
  return selectedPhone;
}


async function validateAdministratorPhone(field, value) {
  return fetch('/installer/validate-phone', {
    method: 'POST',
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({phone: value})
  })
    .then((response) => {
        if (!response.ok) {
            $(".clone-for-" + field).find(".configure-error").text("'" + value + "' is not a valid E.164 number");
            $(".clone-for-" + field).find(".configure-error").show();
            throw Error();
        }
        return response;
    })
    .then((response) => response.json())
    .then((r) => {
        $("#" + field.toLowerCase()).val(r["phone"]);
        return true;
    })
    .catch((err) => {
        return false;
    });
}


/* --------------------------------------------------------------------------------
 * validates variable input values
 *
 * input:
 * global variableInput set in populate()
 *
 * returns:
 * variableInput adding 2 attributes
 * - value
 * - isValid
 * --------------------------------------------------------------------------------
 */
function validateInput() {
  $('.configure-error').text("");
  $('.configure-error').hide("");

  let hasValidationError = false;
  for (v of variableInput) {
    if (! v.configurable) continue; // skip non-configurable variables
    console.log(v);
    const inputValue = $(v.css_id).val();
    //console.log('input is', inputValue);
    if (v.required && !inputValue) {
      $('.clone-for-' + v.key).find(".configure-error").text("This field is required");
      $('.clone-for-' + v.key).find(".configure-error").show();
      hasValidationError = true;
    }
    v['value'] = inputValue;
    v['isValid'] = ! hasValidationError;
  }

  return variableInput;
}


/* --------------------------------------------------------------------------------
 * populate installer page
 * --------------------------------------------------------------------------------
 */
async function populate() {
  const THIS = populate.name;
  try {
    const response = await fetch('/installer/get-configuration', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const configuration = await response.json();
    // console.log(THIS, configuration);

    $(UI.account_name).val(configuration.twilioAccountName);


    for (v of configuration.configurationVariables) {
      if (v.key === 'TWILIO_PHONE_NUMBER') {
        const phoneConfigured = v.value;
        const phoneList = configuration.twilioPhoneNumbers;
        if (phoneList.length === 0) {
          $(".configure-error-twilio-phone-number").show();
        } else {
          phoneList.forEach(phone => {
            const html = phone === v.value
              ? `<option value="${phone.phoneNumber}">${phone.friendlyName}</option>`
              : `<option value="${phone.phoneNumber}" selected>${phone.friendlyName}</option>`;
            $('#twilio_phone_number').append(html);
          });
        }
      }

      await addVariable(v, v.value);
    }

  } catch (err) {
    console.log(err);
    $(".configure-error-login").text("Your Twilio authentication failed. Please try again with correct credentials");
    $(".configure-error-login").show();
  }
}


/* --------------------------------------------------------------------------------
 * check deployment of all deployables
 * --------------------------------------------------------------------------------
 */
function checkDeployment() {
  const THIS = checkDeployment.name;

  try {
    fetch('/installer/check', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then((raw) => raw.json())
      .then((response) => {
        console.log(THIS, 'server returned:', response);
        if (! response.deploy_state) throw new Error('Missing deployable.deploy_state');

        $('.deployable-loader').hide();
        $(`${UI.app_deployer} .button`).removeClass('loading');
        $(UI.app_deployer).show();
        if (response.deploy_state === 'NOT-DEPLOYED') {
          $(UI.app_deployed).hide();
          $(UI.app_open).hide();
          $(UI.service_open).hide();
          $(UI.app_deploy).show();
          $(UI.app_deploy).css('pointer-events', '');
          $(UI.app_redeploy).hide();
          $(UI.app_undeploy).hide();
        } else if (response.deploy_state === 'DEPLOYED') {
          $(UI.app_deployed).show();
          $(UI.app_open).show();
          $(UI.app_open).attr('href', response.application_url);
          $(UI.service_open).show();
          $(UI.service_open).attr('href', `https://www.twilio.com/console/functions/api/start/${response.service_sid}`);
          $(UI.app_deploy).hide();
          $(UI.app_redeploy).show();
          $(UI.app_redeploy).css('pointer-events', '');
          $(UI.app_undeploy).show();
          $(UI.app_undeploy).css('pointer-events', '');
        }
        $(UI.app_deploying).hide();
        $(UI.app_info).text(JSON.stringify(response, undefined, 2));
      });
  } catch (err) {
    console.log(THIS, err);
    window.alert(err);
  }
}


/* --------------------------------------------------------------------------------
 * deploy service
 *
 * action: DEPLOY|REDEPLOY|UNDEPLOY
 * --------------------------------------------------------------------------------
 */
function deploy(e, action) {
  const THIS = deploy.name;

  e.preventDefault();

  const input = validateInput();
  const validated = input.every(i => i.isValid);
  if (! validated) return;

  console.log(THIS, 'variable values validated');
  console.log(THIS, validated);

  const configuration = {};
  for (i of input) {
    if (!i.value) continue;
    configuration[i.key] = i.value;
  }
  console.log(configuration);
  console.log(JSON.stringify(configuration));
  $(`${UI.app_deployer} .button`).addClass('loading');
//    $('.service-loader.button-loader').show();

  $(UI.app_deploy).css('pointer-events', 'none');
  $(UI.app_redeploy).css('pointer-events', 'none');
  $(UI.app_undeploy).css('pointer-events', 'none');
  $(UI.app_deploying).show();

  fetch('/installer/deploy', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: action,
      configuration: configuration,
    }),
  })
    .then(() => {
      console.log(THIS, 'completed');
      checkDeployment();
    })
    .catch ((err) => {
      console.log(THIS, err);
      window.alert(err);
      checkDeployment();
    })
    .finally(() => {
      $(`${UI.app_deployer} .button`).removeClass('loading');
    });
}


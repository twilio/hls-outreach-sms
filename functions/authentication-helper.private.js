/*
 * --------------------------------------------------------------------------------
 * include token validation function using:
 *    const {path} = Runtime.getFunctions()["authentication-helper"];
 *    const {isValidAppToken} = require(path);
 *
 * --------------------------------------------------------------------------------
 *
 *  helper functions to be used only by authentication.js twilio function
 *
 * isValidPassword(password,context)
 * createMfaToken(context,key)
 * createAppToken(issuer,context)
 * checkDisableAuthForLocalhost(context)
 * getVerifyServiceId(context)
 * isValidAppToken(token,context)
 * isValidMfaToken(token,context)
 * isValidRefreshToken

 * --------------------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');

const MFA_TOKEN_DURATION = 5 * 60;
const APP_TOKEN_DURATION = 30 * 60;
const REFRESH_TOKEN_DURATION = 24 * 60 * 60;

function isValidPassword(password, context) {
    return (checkDisableAuthForLocalhost(context) ||
        password === context.APPLICATION_PASSWORD);
}

// --------------------------------------------------------
function createAppToken(issuer, context) {
    return jwt.sign({}, context.AUTH_TOKEN, {
        expiresIn: APP_TOKEN_DURATION,
        audience: 'app',
        issuer,
        subject: 'administrator',
    });
}

// --------------------------------------------------------
function createRefreshToken(issuer, context) {
    return jwt.sign({}, context.AUTH_TOKEN, {
        expiresIn: REFRESH_TOKEN_DURATION,
        audience: 'refresh',
        issuer,
        subject: 'administrator',
    });
}

// --------------------------------------------------------

function createMfaToken(issuer, context) {
    if (checkDisableAuthForLocalhost(context)) {
        return createAppToken(issuer, context);
    }
    return jwt.sign({}, context.AUTH_TOKEN, {
        expiresIn: MFA_TOKEN_DURATION,
        audience: 'mfa',
        issuer,
        subject: 'administrator',
    });
}

// --------------------------------------------------------
function checkDisableAuthForLocalhost(context) {
    return (
        context.DOMAIN_NAME &&
        context.DOMAIN_NAME.startsWith('localhost') &&
        context.DISABLE_AUTH_FOR_LOCALHOST &&
        context.DISABLE_AUTH_FOR_LOCALHOST === 'true'
    );
}

/* -----------------------------------------------------------------------
 * This function returns Verify Service SID that matches VERIFY_SERVICE_NAME.
 * If does not exists it creates a new service.

 * VERIFY_SERVICE_NAME is included in the text message to identify the sender.
 * It is recommended that the customer use their name as VERIFY_SERVICE_NAME
 */
async function getVerifyServiceId(context) {
    const client = context.getTwilioClient();
    let verify_sid = null;
    if(context.VERIFY_SERVICE_NAME === null || context.VERIFY_SERVICE_NAME === ""){
        context.VERIFY_SERVICE_NAME = context.CUSTOMER_NAME;
        console.log("send mfa code ", context.VERIFY_SERVICE_NAME);
    }
    await client.verify.services.list().then((services) => {
        services.forEach((s) => {
            if (s.friendlyName === context.VERIFY_SERVICE_NAME) {
                verify_sid = s.sid;
            }
        });
    }).catch(function(err) {
        console.log("Error ", err);
    });
    if (verify_sid !== null) {
        return verify_sid;
    }

    await client.verify.services
        .create({ friendlyName: context.VERIFY_SERVICE_NAME })
        .then((result) => {
            verify_sid = result.sid;
        });
    if (verify_sid !== null) {
        return verify_sid;
    }
    console.log('Unable to create a Twilio Verify Service!!! ABORTING!!! ');
    return null;
}
// -----------------------------------------------------

function isValidMfaToken(token, context) {
    try {
        return (
            checkDisableAuthForLocalhost(context) ||
            jwt.verify(token, context.AUTH_TOKEN, { audience: 'mfa' })
        );
    } catch (err) {
        return false;
    }
}

// ---------------------------------------------------------
function isValidAppToken(token, context) {
    try {
        return (
            checkDisableAuthForLocalhost(context) ||
            jwt.verify(token, context.AUTH_TOKEN, { audience: 'app' })
        );
    } catch (err) {
        console.log(err);
        return false;
    }
}

// ---------------------------------------------------------
function isValidRefreshToken(token, context) {
    try {
        return (
            checkDisableAuthForLocalhost(context) ||
            jwt.verify(token, context.AUTH_TOKEN, { audience: 'refresh' })
        );
    } catch (err) {
        console.log(err);
        return false;
    }
}
// ---------------------------------------------------------
module.exports = {
    isValidPassword,
    createMfaToken,
    createAppToken,
    createRefreshToken,
    isValidMfaToken,
    getVerifyServiceId,
    isValidAppToken,
    isValidRefreshToken,
    checkDisableAuthForLocalhost
}
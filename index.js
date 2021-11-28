//twitterbot script
var keys = require("./keys.json");

/*
 * This pre-request script retrieves a Bearer token from the client credentials
 * you provide in your environment file.
 */
// Retrieve env variables currently configured
const env_variables = pm.environment.toObject({
    excludeDisabled: true
});

const addToken = () => {
    pm.sendRequest({
        url: 'https://api.twitter.com/oauth2/token',
        method: 'POST',
        auth: {
            type: 'basic',
            basic: {
                username: keys.consumer_key,
                password: keys.consumer_secret
            }
        },
        headers: {
            'Content-type': 'Content-type: application/x-www-form-urlencoded; charset: utf-8'
        },
        body: {
            mode: 'urlencoded',
            urlencoded: 'grant_type=client_credentials'
        }
    }, (err, res) => {
        if (err) {
            console.error('Error while generating a bearer token:', err);
        } else {
            const {access_token} = res.json();
            keys.bearer_token = access_token;
            pm.environment.set('bearer_token', access_token);
        }
    });
}

const prepareBearerToken = () => {
    // Check if the required variables are set
    for (const key of ['consumer_key', 'consumer_secret']) {
        if (typeof env_variables[key] === 'undefined' || !env_variables[key]) {
            console.error('Missing required env variable:', key);
            return;
        }
    }
    
    // Use an existing Bearer token, if already provided
    if (typeof keys.bearer_token === 'undefined' || keys.bearer_token === '' || keys.bearer_token === null || keys.bearer_token.toLowerCase() === 'your bearer token') {
        addToken();
    }
}

prepareBearerToken();

const prepareOAuthSignature = () => {
    /*
     * This is a Pre-request script for Postman client to remediate OAuth 1.0a issue
     * where certain request fails if the query parameter includes some specific characters.
     * https://tools.ietf.org/html/rfc3986#section-2.2 (rfc3986, gen-delims reserved characters)
     *
     * NOTE: This Pre-script is intended to use with "GET" request but might be able to
     *       work with other methods that have no request body.
     *       For "POST" request, there's another workaround.
     *       See: https://github.com/twitterdev/postman-twitter-ads-api/issues/2
     * 
     * In order to use this Pre-request script, you need to change your "Authorization" type to
     * "No Auth" only for the target request and do not apply to the top-level object.
     */
    
    const sdk = require('postman-collection');
    
    function toArray(object) {
        let array = [];
        Object.keys(object).forEach(key => {
            array.push(`${key}=${object[key]}`);
        });
        return array
    }
    
    // fetch all env variables that are currently defined
    const env_variables = pm.environment.toObject({
        excludeDisabled: true
    });
    
    const oauth_consumer_key = env_variables.consumer_key;
    const oauth_consumer_secret = env_variables.consumer_secret;
    const oauth_token = env_variables.access_token;
    const oauth_secret = env_variables.token_secret;
    const oauth_signing_key = `${oauth_consumer_secret}&${oauth_secret}`;
    
    // create random oauth_nonce string
    const random_source = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let oauth_nonce = '';
    for (let i = 0; i < 32; i++) {
        oauth_nonce += random_source.charAt(Math.floor(Math.random() * random_source.length));
    }
    
    const oauth_parameter_string_object = {};
    oauth_parameter_string_object.oauth_consumer_key = oauth_consumer_key;
    oauth_parameter_string_object.oauth_token = oauth_token;
    const oauth_nonce_array = CryptoJS.enc.Utf8.parse(oauth_nonce);
    oauth_parameter_string_object.oauth_nonce = encodeURIComponent(CryptoJS.enc.Base64.stringify(oauth_nonce_array));
    oauth_parameter_string_object.oauth_signature_method = 'HMAC-SHA1';
    oauth_parameter_string_object.oauth_version = '1.0';
    oauth_parameter_string_object.oauth_timestamp = Math.round((new Date()).getTime() / 1000);
    
    // for Authorization request header (copy object)
    const oauth_authorization_header_object = Object.assign({}, oauth_parameter_string_object);
    
    // convert query string into object (+ encode)
    const url_query_string_object = {};
    
    const url_query_string_object_array = sdk.QueryParam.parse(
        pm.request.url.getQueryString({
            ignoreDisabled: true
        })
    ).filter(el => !!el.key);
    
    url_query_string_object_array.forEach(item => {
        url_query_string_object[item.key] = encodeURIComponent(item.value);
    });
    
    // merge query parameter
    Object.assign(oauth_parameter_string_object, url_query_string_object);
    
    // sort object by key
    const oauth_parameter_string_object_ordered = {};
    Object.keys(oauth_parameter_string_object).sort().forEach(function(key) {
        oauth_parameter_string_object_ordered[key] = oauth_parameter_string_object[key];
    });
    
    // generate parameter string
    const oauth_parameter_string = toArray(oauth_parameter_string_object_ordered).join('&');
    
    // replace dynamic variables
    let base_host = pm.request.url.getOAuth1BaseUrl();
    let regexp = /{{(.*?)}}/g;
    let result = null;
    while (result = regexp.exec(base_host)) {
        let value = env_variables[result[1]];
        base_host = base_host.replace(new RegExp(`{{${result[1]}}}`, 'g'), value);
    }
    
    // generate base string
    const oauth_base_string = `${pm.request.method}&${encodeURIComponent(base_host)}&${encodeURIComponent(oauth_parameter_string)}`;
    
    // generate signature
    const oauth_signature = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(oauth_base_string, oauth_signing_key));
    
    oauth_authorization_header_object.oauth_signature = encodeURIComponent(oauth_signature);
    
    // generate Authorization header string
    const oauth_authorization_header = toArray(oauth_authorization_header_object).join(', ');
    
    // generate Authorization header
    pm.request.headers.add({
        key: 'Authorization',
        value: `OAuth ${oauth_authorization_header}`
    });
    
    // Escape URI parameters using encodeURIComponent => RFC3986
    if (Object.keys(url_query_string_object).length !== 0) {
        // generate query parameter string
        const request_parameter_string = toArray(url_query_string_object).join('&');
    
        pm.request.url = `${pm.request.url.getOAuth1BaseUrl()}?${request_parameter_string}`;
    }
}

if (typeof pm.request.auth !== 'undefined' && pm.request.auth.type === 'oauth1') {
    prepareOAuthSignature();
}

// CREATE TWEET
// This script extracts the ID of the authenticating user, so you do not have to pass it yourself.
if (!pm.environment.get('access_token') || !pm.request.url.path.includes(':id')) {
    return;
}

const [userId] = pm.environment.get('access_token').split('-');

if (!userId) {
    return;
}

const userIdIndex = pm.request.url.path.indexOf(':id');
pm.request.url.path[userIdIndex] = userId;
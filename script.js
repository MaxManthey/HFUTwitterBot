//import Oauth1Helper from "./OauthHelper";
const Oauth1Helper = require('./OauthHelper.js')
const axios = require('axios')

const request = {
    url: 'https://api.twitter.com/2/tweets',
    method: 'POST',
    body: {
        "text": "Script Test2"
    }
};

const authHeader = Oauth1Helper.getAuthHeaderForRequest(request);
// console.log(authHeader)


async function postTweet() {
    return await axios.post(
        request.url,
        request.body,
        { headers: authHeader }
    );
}

postTweet()
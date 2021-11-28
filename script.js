const Oauth1Helper = require('./OauthHelper.js')
const axios = require('axios')
var prompt = require('prompt-sync')();

function postTweet(tweet) {
    const request = {
        url: 'https://api.twitter.com/2/tweets',
        method: 'POST',
        body: {
            "text": tweet
        }
    };

    const authHeader = Oauth1Helper.getAuthHeaderForRequest(request);

    return axios.post(
        request.url,
        request.body,
        { headers: authHeader }
    )
}

function main() {
    var tweet = prompt('What would you like to tweet? ');
    postTweet(tweet)
}

main()
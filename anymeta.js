var AnyMeta= {};

AnyMeta.sites = {};
// simply add sites you want to support in the following format
// for most (all?) AnyMeta sites you should only need to replace the consumer key and secret and update the URLs to the correct domain
// get at http://www.mediamatic.net/module/OAuth/server/register
AnyMeta.sites['mediamatic.net'] = {
    apiEndpoint: "http://www.mediamatic.net/services/rest/",
    consumerKey: "CHANGE_ME",
    consumerSecret: "CHANGE_ME",
    serviceProvider: {
        signatureMethod     : "HMAC-SHA1",
        requestTokenURL     : "http://www.mediamatic.net/module/OAuth/request_token",
        userAuthorizationURL: "http://www.mediamatic.net/module/OAuth/authorize",
        accessTokenURL      : "http://www.mediamatic.net/module/OAuth/access_token",
        echoURL             : "http://www.mediamatic.net/services/rest/?method=anymeta.test.echo"
    }
}

AnyMeta.callback = function callback(result) {
    console.log('Callback firing at', (new Date()).getTime());
    console.log('received:', result);
}

AnyMeta.register = function register(site, callback, errback) {
    var accessor = AnyMeta.sites[site];
    var message = {
        action: accessor.serviceProvider.requestTokenURL,
        method: 'POST',
        parameters: []
    };
    
    // 1. get request token
    var requestBody = OAuth.formEncode(message.parameters);
    OAuth.completeRequest(message, accessor);
    var authorizationHeader = OAuth.getAuthorizationHeader("", message.parameters);
    var requestToken = new XMLHttpRequest();
    requestToken.onreadystatechange = function receiveRequestToken() {
        if (requestToken.readyState == 4) {
            if (requestToken.responseText) {
                var results = OAuth.decodeForm(requestToken.responseText);
                if (results) {
                    // 2. authorize request token elsewhere (xAuth is the solution here)
                    alert("Please go to " + accessor.serviceProvider.userAuthorizationURL + '&oauth_token=' + OAuth.getParameter(results, "oauth_token") + '\nWhen done click ok.');
                    console.log(accessor.serviceProvider.userAuthorizationURL + '&oauth_token=' + OAuth.getParameter(results, "oauth_token"));
                    message = {method: "POST", action: accessor.serviceProvider.accessTokenURL, parameters: []};
                    OAuth.completeRequest(message, {
                        consumerKey: accessor.consumerKey,
                        consumerSecret: accessor.consumerSecret,
                        token: OAuth.getParameter(results, "oauth_token"),
                        tokenSecret: OAuth.getParameter(results, "oauth_token_secret")
                    });
                    var requestAccess = new XMLHttpRequest();
                    requestAccess.onreadystatechange = function receiveAccessToken() {
                        if (requestAccess.readyState == 4) {
                            var params = OAuth.getParameterMap(requestAccess.responseText);
                            if (params) {
                                callback(params);
                            } else {
                                errback(requestAccess);
                            }
                        }
                    };
                    requestAccess.open(message.method, message.action, true); 
                    requestAccess.setRequestHeader("Authorization", OAuth.getAuthorizationHeader("", message.parameters));
                    requestAccess.send();
                } else {
                    errback(requestToken);
                }
            }
        }
    };
    requestToken.open(message.method, message.action, true); 
    requestToken.setRequestHeader("Authorization", authorizationHeader);
    requestToken.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    requestToken.send(requestBody);
}

AnyMeta.request = function request(method, site, auth_tokens, apiMethod, parameters, body, callback, errback) {
    if (parameters instanceof Array) {
        parameters.push(['format', 'json']);
        parameters.push(['method', apiMethod]);
    } else {
        // assuming an object
        parameters['format'] = 'json';
        parameters['method'] = method;
    }
    
    var accessor = AnyMeta.sites[site];
    accessor['token'] = auth_tokens['oauth_token'];
    accessor['tokenSecret'] = auth_tokens['oauth_token_secret'];
    var message = {
        action: OAuth.addToURL(AnyMeta.sites[site].apiEndpoint, parameters),
        method: method,
        parameters: body,
    };
    
    var requestBody = OAuth.formEncode(message.parameters);
    OAuth.completeRequest(message, accessor);
    var authorizationHeader = OAuth.getAuthorizationHeader("", message.parameters);
    var requestToken = new XMLHttpRequest();
    requestToken.onreadystatechange = function receiveRequestToken() {
        if (requestToken.readyState == 4) {
            if (requestToken.responseText) {
                // var results = OAuth.decodeForm(requestToken.responseText);
                var results = JSON.parse(requestToken.responseText);
                if (results) {
                    // console.log(requestToken.responseText);
                    callback(results);
                } else {
                    errback(requestToken);
                }
            }
        }
    };
    requestToken.open(message.method, message.action, true); 
    requestToken.setRequestHeader("Authorization", authorizationHeader);
    requestToken.setRequestHeader("Content-Type", "application/json");
    requestToken.send(requestBody);
}

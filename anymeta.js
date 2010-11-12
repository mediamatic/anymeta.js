var AnyMeta = {};

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
AnyMeta.currentSite = null;

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
                    var userAuthURL = accessor.serviceProvider.userAuthorizationURL + '&oauth_token=' + OAuth.getParameter(results, "oauth_token");
                    // 3. exchange request token for access token
                    var getAccessToken = function getAccessToken(callback2, errback2) {
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
                                    callback2(params);
                                } else {
                                    errback2(requestAccess);
                                }
                            }
                        };
                        requestAccess.open(message.method, message.action, true); 
                        requestAccess.setRequestHeader("Authorization", OAuth.getAuthorizationHeader("", message.parameters));
                        requestAccess.send();
                    }
                    // 2. authorize request token elsewhere (xAuth is the solution here)
                    callback(userAuthURL, getAccessToken);
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

// a raw request with none of the nice wrapping that will be done eventually
/*
AnyMeta.request(
	'GET',               // the HTTP request method
	'mediamatic.net',    // the server in AnyMeta.servers to use
	{'oauth_token': auth_token, 'oauth_token_secret': auth_token_secret},
	'anymeta.user.info', // the AnyMeta API method
	[],                  // query parameters in the [[key, value], [key, value]] format oauth.js likes
	[],                  // request body, again in the same format
	function(person) {   // the success callback
		var h1 = document.createElement('h1');
		h1.innerHTML = 'Welcome <a href="http://www.mediamatic.net/person/' + person.id + '/en">' + person.title + '</a>!';
		document.body.appendChild(h1);
        listObject(person, document.body);
	},
	function() { console.log('error'); } // the error callback (errback)
);
*/
AnyMeta.request = function request(method, site, authTokens, apiMethod, parameters, body, callback, errback) {
    if (parameters instanceof Array) {
        parameters.push(['format', 'json']);
        parameters.push(['method', apiMethod]);
    } else {
        // assuming an object
        parameters['format'] = 'json';
        parameters['method'] = method;
    }
    
    var accessor = AnyMeta.sites[site];
    accessor['token'] = authTokens['oauth_token'];
    accessor['tokenSecret'] = authTokens['oauth_token_secret'];
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

AnyMeta.wrappedRequest = function wrappedRequest(method, apiMethod, parameters, body, callback, errback) {
    var authTokens = {
        'oauth_token': AnyMeta.sites[AnyMeta.currentSite].token,
        'oauth_token_secret': AnyMeta.sites[AnyMeta.currentSite].tokenSecret
    };
    AnyMeta.request(method, AnyMeta.currentSite, authTokens, apiMethod, parameters, body, callback, errback);
}

AnyMeta.setTokens = function setTokens(token, tokenSecret) {
    AnyMeta.sites[AnyMeta.currentSite].token = token;
    AnyMeta.sites[AnyMeta.currentSite].tokenSecret = tokenSecret;
}

// NOOP function to replace undefined callback or errback functions
AnyMeta.NOOP = function NOOP() {};

AnyMeta.user = {};
AnyMeta.user.info = function info(parameters, callback, errback) {
    // see if we got parameters and body or callback and errback
    if (arguments.length == 2) {
        if (arguments[0] instanceof Function && arugments[1] instanceof Function) {
            parameters = [];
            callback = arguments[0];
            errback = arguments[1];
        } else {
            // assume errback was omitted, add it
            errback = AnyMeta.NOOP;
        }
    } else if (arguments.length == 1 && arguments[0] instanceof Function) {
        // we only have callback
        parameters = [];
        callback = arguments[0];
        errback = AnyMeta.NOOP;
    }
    AnyMeta.wrappedRequest('GET', 'anymeta.user.info', parameters, [], callback, errback);
}

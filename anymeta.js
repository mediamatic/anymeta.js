var AnyMeta = {};
AnyMeta.apiVersion = 1;

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

AnyMeta.register = function register(callback, errback) {
    var accessor = AnyMeta.sites[AnyMeta.currentSite];
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
                    var userAuthURL = accessor.serviceProvider.userAuthorizationURL + '?oauth_token=' + OAuth.getParameter(results, "oauth_token");
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
    
    if (method == 'GET') {
        var message = {
            action: OAuth.addToURL(AnyMeta.sites[site].apiEndpoint, parameters),
            method: method,
            parameters: [],
        };
    } else if (method = 'POST') {
        var allvals = body;
        for (var k in parameters) {
            allvals.push(parameters[k]);
        }
        var message = {
            action: AnyMeta.sites[site].apiEndpoint,
            method: method,
            parameters: allvals,
        }
    }
    
    OAuth.completeRequest(message, accessor);
    
    if (method == 'POST') {    
        // put absolutely everything, including the OAuth signature information, in the request body
        //   AnyMeta seems to require this despite it not being part of the OAuth standard
        var requestBody = OAuth.formEncode(allvals);
    } else {
        var requestBody = OAuth.formEncode([]);
    }
    
    var authorizationHeader = OAuth.getAuthorizationHeader("", message.parameters);
    var request = new XMLHttpRequest();
    request.onreadystatechange = function receiveRequestToken() {
        if (request.readyState == 4) {
            if (request.responseText) {
                var results = JSON.parse(request.responseText);
                // FIXME: we can have a 200 response but still an error, since we'll get an object back with an error key. Pass that to the errback.
                if (results) {
                    callback(results);
                } else {
                    errback(request);
                }
            }
        }
    };
    request.open(message.method, message.action, true); 
    request.setRequestHeader("Authorization", authorizationHeader);
    request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    request.send(requestBody);
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
AnyMeta.user.create = function create(fullname, email, enabled, confirm, password, sendconfirm, callback, errback) {
    var body = [];
    // fullname and email are required, so assume they're there
    body.push(['fullname', fullname]);
    body.push(['email', email]);
    // just gave a callback
    if (arguments.length == 3 && arguments[2] instanceof Function) {
        callback = arguments[2];
        errback = AnyMeta.NOOP;
    }
    // just gave callback and errback
    else if (arguments.length == 4 && arguments[2] instanceof Function && arguments[3] instanceof Function) {
        callback = arguments[2];
        errback = arguments[3];
    }
    // else all body are assumed to have been given
    else {
        body.push(['enabled', enabled]);
        body.push(['confirm', confirm]);
        body.push(['password', password]);
        body.push(['sendconfirm', sendconfirm]);
    }
    AnyMeta.wrappedRequest('POST', 'anymeta.user.create', [], body, callback, errback);
}
AnyMeta.user.info = function info(person_id, callback, errback) {
    var parameters = [];
    // see if we got parameters and body or callback and errback
    if (arguments.length == 2) {
        if (arguments[0] instanceof Function && arguments[1] instanceof Function) {
            parameters = [];
            callback = arguments[0];
            errback = arguments[1];
        } else {
            parameters.push(['person_id', person_id]);
            errback = AnyMeta.NOOP;
        }
    } else if (arguments.length == 1 && arguments[0] instanceof Function) {
        // we only have callback
        parameters = [];
        callback = arguments[0];
        errback = AnyMeta.NOOP;
    } else {
        parameters.push(['person_id', person_id]);
    }
    AnyMeta.wrappedRequest('GET', 'anymeta.user.info', parameters, [], callback, errback);
}

AnyMeta.thing = {};
AnyMeta.thing.discover = function dump(resource_uri, callback, errback) {
    if (arguments.length == 2) {
        errback = AnyMeta.NOOP;
    }
    AnyMeta.wrappedRequest('GET', 'anymeta.thing.discover', [['uri', resource_uri]], [], callback, errback);
}
AnyMeta.thing.dump = function dump(thing_id, callback, errback) {
    if (arguments.length == 2) {
        errback = AnyMeta.NOOP;
    }
    AnyMeta.wrappedRequest('GET', 'anymeta.thing.dump', [['id', thing_id]], [], callback, errback);
}
AnyMeta.thing.duplicate = function dump(thing_id, callback, errback) {
    if (arguments.length == 2) {
        errback = AnyMeta.NOOP;
    }
    AnyMeta.wrappedRequest('POST', 'anymeta.thing.duplicate', [['thing_id', thing_id]], [], callback, errback);
}

AnyMeta.predicates = {};
// fields must be an array in the format ['field']
// FIXME: multiple fields don't work
/*
    AnyMeta.predicates.get(
        '55',
        'text.title',
        function (thing) {
            var h1 = document.createElement('h1');
            h1.innerHTML = 'anymeta.predicates.get';
            document.body.appendChild(h1);
            listObject(thing, document.body);
        }
    );
*/
AnyMeta.predicates.get = function get(thing_id, fields, lang, wikify, callback, errback) {
    // assume id is always given
    var parameters = [['id', thing_id]];
    // fields are also required
    if (!(fields instanceof Array)) {
        fields = [fields];
    }
    for (var k in fields) {
        parameters.push(['field', fields[k]]); // not sure this is how the method takes an array of fields...
    }
    // just gave a callback
    if (arguments.length == 3 && arguments[2] instanceof Function) {
        callback = arguments[2];
        errback = AnyMeta.NOOP;
    }
    // just gave callback and errback
    else if (arguments.length == 4 && arguments[2] instanceof Function && arguments[3] instanceof Function) {
        callback = arguments[2];
        errback = arguments[3];
    }
    // else all parameters are assumed to have been given
    else {
        parameters.push(['lang', lang]);
        parameters.push(['wikify', wikify]);
    }
    AnyMeta.wrappedRequest('GET', 'anymeta.predicates.get', parameters, [], callback, errback);
}

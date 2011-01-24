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
                try {
                    var results = JSON.parse(request.responseText);
                    // if we didn't get an error object
                    if (!('error' in results)) {
                        callback(results);
                    } else {
                        errback(results);
                    }
                } catch (e) {
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

// just preps a query function with the provided method
AnyMeta.__prepManyParamMethod = function __prepManyParamMethod(method, apiMethod) {
  // don't take all the parameters individually because there are so many of them
  // conditions can either be a dictionary or the OAuth-friendly list
  return function(conditions, callback, errback) {
    if (conditions instanceof Array) {
      var parameters = conditions;
    }
    // else assume it's an object
    else {
      var parameters = [];
      for (var key in conditions) {
        if (conditions.hasOwnProperty(key)) {
          parameters.push([key, conditions[key]]);
        }
      }
    }
    
    if (arguments.length == 3) {
      errback = AnyMeta.NOOP;
    }
    
    AnyMeta.wrappedRequest(method, apiMethod, parameters, [], callback, errback);
  }
}

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
AnyMeta.thing.makeAuthoritative = function makeAuthoritative(thing_id, keep_subscription, callback, errback) {
  if (arguments.length == 2 && arguments[1] instanceof Function) {
    keep_subscription = false;
    callback = arguments[1];
    errback = AnyMeta.NOOP;
  }
  else if (arguments.length == 3 && arguments[1] instanceof Function && arguments[2] instanceof Function) {
    keep_subscription = false;
    callback = arguments[1];
    errback = arguments[2];
  }
  else if (arguments.length == 3) {
    errback = AnyMeta.NOOP;
  }
  AnyMeta.wrappedRequest('POST', 'anymeta.thing.makeAuthoritative', [['id', thing_id], ['keep_subscription', keep_subscription]], [], callback, errback);
}
AnyMeta.thing.makeNonAuthoritative = function makeNonAuthoritative(thing_id, resource_uri, callback, errback) {
  if (arguments.length == 3) {
    errback = AnyMeta.NOOP;
  }
  AnyMeta.wrappedRequest('POST', 'anymeta.thing.makeNonAuthoritative', [['id', thing_id], ['rsc_uri', resource_uri]], [], callback, errback);
}
AnyMeta.thing.insert = function insert(data, callback, errback) {
  if (arguments.length == 2) {
    errback = AnyMeta.NOOP;
  }
  AnyMeta.wrappedRequest('POST', 'anymeta.thing.insert', [['data', data]], [], callback, errback);
}
AnyMeta.thing.update = function update(thing_id, data, callback, errback) {
  if (arguments.length == 3) {
    errback = AnyMeta.NOOP;
  }
  AnyMeta.wrappedRequest('POST', 'anymeta.thing.update', [['thing_id', thing_id], ['data', data]], [], callback, errback);
}
// Have to use del instead of delete because otherwise the interpreter will detect the delete operator
AnyMeta.thing.del = function del(thing_id, followup, secure, callback, errback) {
  var parameters = [['thing_id', thing_id]];
  if (arguments.length == 2 && arguments[1] instanceof Function) {
    callback = arguments[1];
    errback = AnyMeta.NOOP;
  }
  else if (arguments.length == 3 && arguments[1] instanceof Function && arguments[2] instanceof Function) {
    callback = arguments[1];
    errback = arguments[2];
  }
  // else all parameters are assumed to have been given
  else {
    parameters.push(['followup', followup]);
    parameters.push(['secure', secure]);
  }
    
  AnyMeta.wrappedRequest('POST', 'anymeta.things.delete', parameters, [], callback, errback);
}


AnyMeta.predicates = {};
// fields must be an array in the format ['field1', 'field2']
AnyMeta.predicates.get = function get(thing_id, fields, lang, wikify, callback, errback) {
    // assume id is always given
    var parameters = [['id', thing_id]];
    // fields are also required
    if (!(fields instanceof Array)) {
        fields = [fields];
    }
    for (var k in fields) {
        parameters.push(['field[' + k + ']', fields[k]]);
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
AnyMeta.predicates.set = function set(thing_id, field, value, lang, name, callback, errback) {
  var parameters = [['id', thing_id], ['field', field], ['value', value]];
  if (arguments.length == 4 && arguments[3] instanceof Function) {
    callback = arguments[3];
    errback = AnyMeta.NOOP;
  }
  else if (arguments.length == 5 && arguments[3] instanceof Function && arguments[4] instanceof Function) {
    callback = arguments[3];
    errback = arguments[4];
  }
  // else assume all parameters are given
  else {
    parameters.push(['lang', lang]);
    parameters.push(['name', name]);
  }
  
  AnyMeta.wrappedRequest('POST', 'anymeta.predicates.set', parameters, [], callback, errback);
}

AnyMeta.attachment = {};
AnyMeta.attachment.create = function create(data, mime, title, connect, modifier_id, callback, errback) {
  var parameters = [['data', data], ['mime', mime]];
  if (arguments.length == 3 && arguments[2] instanceof Function) {
    callback = arguments[2];
    errback = AnyMeta.NOOP;
  }
  else if (arguments.length == 4 && arguments[2] instanceof Function && arguments[3] instanceof Function) {
    callback = arguments[2];
    errback = arguments[3];
  }
  else if (arguments.length == 4 && arguments[3] instanceof Function) {
    parameters.push(['title', title]);
    callback = arguments[3];
    errback = AnyMeta.NOOP;
  }
  else if (arguments.length == 5 && arguments[3] instanceof Function && arguments[4] instanceof Function) {
    parameters.push(['title', title]);
    callback = arguments[3];
    errback = arguments[4];
  }
  else if (arguments.length == 5 && arguments[4] instanceof Function) {
    parameters.push(['title', title]);
    parameters.push(['connect', connect]);
    callback = arguments[4];
    errback = AnyMeta.NOOP;
  }
  else if (arguments.length == 6 && arguments[4] instanceof Function && arguments[5] instanceof Function) {
    parameters.push(['title', title]);
    parameters.push(['connect', connect]);
    callback = arguments[4];
    errback = arguments[5];
  }
  // else all arguments are present
  else {
    parameters.push(['title', title]);
    parameters.push(['connect', connect]);
    parameters.push(['modifier_id', modifier_id]);
  }
  
  AnyMeta.wrappedRequest('POST', 'anymeta.attachment.create', parameters, [], callback, errback);
}

AnyMeta.query = {};
// since the only difference between query.execute and query.search is the response formats, which we don't process, share a common base function
AnyMeta.query.execute = AnyMeta.query.__prepManyParamMethod('GET', 'anymeta.query.execute');
AnyMeta.query.search = AnyMeta.query.__prepManyParamMethod('GET', 'anymeta.query.search');

AnyMeta.edge = {};
AnyMeta.edge.add = AnyMeta.query.__prepManyParamMethod('POST', 'anymeta.edge.add');
// NOTE: the edge or object + predicate is accessed via the arguments variable
AnyMeta.edge.remove = function remove(thing_id, callback, errback) {
  var parameters = [['id', thing_id]];
  if (arguments.length == 3 && arguments[2] instanceof Function) {
    parameters.push(['edge', arguments[1]]);
    callback = arguments[2];
    errback = AnyMeta.NOOP;
  }
  else if (arguments.length == 4 && arguments[2] instanceof Function && arguments[3] instanceof Function) {
    parameters.push(['edge', arguments[1]]);
    callback = arguments[2];
    errback = arguments[3];
  }
  else if (arguments.length == 4 && arguments[3] instanceof Function) {
    parameters.push(['object', arguments[1]]);
    parameters.push(['predicate', arguments[2]]);
    callback = arguments[3];
    errback = AnyMeta.NOOP;
  }
  else if (arguments.length == 5 && arguments[3] instanceof Function && arguments[4] instanceof Function) {
    parameters.push(['object', arguments[1]]);
    parameters.push(['predicate', arguments[2]]);
    callback = arguments[3];
    errback = arguments[4];
  }
  
  AnyMeta.wrappedRequest('POST', 'anymeta.edge.add', parameters, [], callback, errback);
}

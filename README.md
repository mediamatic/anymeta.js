# anyMeta.js

This is a Javascript library that makes asynchronous interactions with anyMeta servers quite easy in Javascript. API methods match those, with the addition of a callback function and an optional errback function as the last two parameters. Not all API methods have been implemented as Javascript functions but the ones that do exist include common methods for things, edges, predicates, and users. As these functions only make it easier to call the function AnyMeta.wrappedRequest, you can easily extend the library and write your own wrappers if you find that a function for a method you want to use is missing.

Because anymeta.js assumes the presence of XMLHttpRequest and one which is, naturally, able to make requests to the anyMeta server requested. It will work, naturally, when the anyMeta site is on the same domain. However, anyMeta does not currently support [Cross-Origin Resource Sharing](http://www.w3.org/TR/cors/), meaning that cross-domain requests will normally not work.

For requests outside of a standard browser environment, some work may be required. iPhone and Android apps written using PhoneGap or similar web view-based approaches will work if the Javascript code making the request is local to the app (e.g. accessed via the file:// protocol). In other environments you may need to mimic XMLHttpRequest, for instance with [env.js](http://www.envjs.com/), or modify anymeta.js to use a different networking mechanism.

## Getting Started

Add anyMeta.js to your app, perhaps as a [git submodule](http://www.kernel.org/pub/software/scm/git/docs/git-submodule.html).

Add site information to `AnyMeta.sites` like so:

    AnyMeta.sites['siteAlias'] = {
        apiEndpoint: "http://site.address/services/rest/",
        consumerKey: "your consumer key",
        consumerSecret: "your consumer secret",
        serviceProvider: {
            signatureMethod     : "HMAC-SHA1",
            requestTokenURL     : "http://site.address/module/OAuth/request_token",
            userAuthorizationURL: "http://site.address/module/OAuth/authorize",
            accessTokenURL      : "http://site.address/module/OAuth/access_token",
            echoURL             : "http://site.address/services/rest/?method=anymeta.test.echo"
        }
    }
    AnyMeta.currentSite = 'siteAlias';

Have your app request authorization from the user:

    AnyMeta.register(
        // once the system is ready to hand off to us to have the user authorize us on the AnyMeta site in question
        // url is the url the user should visit to authorize us
        // callback is the function we should call once the user says they have successfully authorized us
        function (url, callback) {
            // Have the user go to the URL and authorize the app.
            // At the simplest: alert("Please go to " + url + "\nWhen done click ok.");
            callback(
                function (tokens) {
                    // You'll probably want to persist the auth_token for later
                    // For example:
                    // localStorage.setItem(AnyMeta.currentSite + '.oauth_token', tokens.oauth_token);
                    // localStorage.setItem(AnyMeta.currentSite + '.oauth_token_secret', tokens.oauth_token_secret);
                    // Give the API the credentials for the current site to make authorized requests
                    AnyMeta.setTokens(tokens.oauth_token, tokens.oauth_token_secret);
                }
            )
        }
    )

Finally, make authorized API calls. For example:

    AnyMeta.user.info(
        function (person) {
            var h1 = document.createElement('h1');
            h1.innerHTML = 'Welcome <a href="http://site.address/person/' + person.id + '/en">' + person.title + '</a>!';
            document.body.appendChild(h1);
        }
    )

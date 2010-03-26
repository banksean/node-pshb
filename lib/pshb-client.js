var sys = require('sys'),
  fs = require('fs'),
	sax = require("../third_party/sax-js/lib/sax"),
  path = require("path"),
  http = require("http"),
	events = require("events"),
	url = require("url"),
	atom = require("./atom"),
	querystring = require('querystring');
	
var Subscriber = function(callbackPort, async) {
  if (!callbackPort) {
    callbackPort = 8000;
  }
  this.callbackPort = callbackPort;
  if (async) {
    this.verify = 'async'; // TODO
  } else {
    this.verify = 'sync';
  }

  this.topicEventEmitters = {};
};

exports.Subscriber = Subscriber;

Subscriber.prototype.createCallbackUri = function() {
  // TODO: use an actual hostname.
  return "http://localhost:" + this.callbackPort + "/";
};

Subscriber.prototype.subscribe = function(topicUri, hubUri, callbackUri, callbackFn, errbackFn) {
	var callback = callbackUri.href,
	  mode = "subscribe",
	  topic = topicUri.href,
	  verify = this.verify,
		lease_seconds = '', // TODO
		secret = '', // TODO
		verify_token= ''; // TODO

		var requestBody = [
			"hub.callback=" + querystring.escape(callback),
			"hub.mode=" + querystring.escape(mode),
			"hub.topic=" + querystring.escape(topic),
			"hub.verify=" + querystring.escape(verify),
			"hub.lease_seconds=" + querystring.escape(lease_seconds),
			"hub.secret=" + querystring.escape(secret),
			"hub.verify_token=" + querystring.escape(verify_token)
			].join("&");
  
    hubUri = url.parse(hubUri.href);
  
    var port = hubUri.port;
    if (!port) {
      port = 80;
    }

    var hubHost = hubUri.host;
    if (hubHost.indexOf(":") != -1) {
      hubHost = hubHost.split(":")[0];
    }

    var hubClient = http.createClient(port, hubHost);

		var path = hubUri.pathname || "";
		if (hubUri.search) {
			path += hubUri.search;
		}

		var hubRequest = hubClient.request("POST", path, 
		    {
		      "Host": hubHost,
		      "Accept": "*/*",
		      "Content-length": requestBody.length,
		      "Content-Type": "application/x-www-form-urlencoded"
		    }
		);

		hubRequest.addListener('response', function (response) {
		  var body = "";
      response.setBodyEncoding("utf8");
			response.addListener('data', function (chunk) {
				body += chunk;
		  });

			response.addListener('end', function() {
			  if (response.statusCode == 202) {
          // Accepted means success for an async request, but we need
          // to wait for async verification request now.			    
          callbackFn();
			  } else if (response.statusCode == 204) {
          // No-Content means success for a sync sub.
          callbackFn();
			  } else {
			    // Any other response code is an error.
			    errbackFn(body);
			  }
			})
		});

		hubRequest.write(requestBody);
		hubRequest.close();
}

Subscriber.prototype.registerEventEmitter = function(topicUri, topicEvents) {
  this.topicEventEmitters[topicUri.href] = topicEvents;
};

Subscriber.prototype.listen = function(topicUri) {
  var topicHost = topicUri.host;
  var subscriber = this;
  if (topicHost.indexOf(":") != -1) {
    topicHost = topicHost.split(":")[0];
  }
  var topicPort = topicUri.port;
  if (!topicPort) {
    topicPort = 80;
  }
	var topicPath = topicUri.pathname || "";
	if (topicUri.search) {
		topicPath += topicUri.search;
	}

  var topicClient = http.createClient(topicPort, topicHost);
  var topicRequest = topicClient.request("GET", topicPath, {"Host": topicHost});
  var topicEvents = new events.EventEmitter();

  topicRequest.addListener('response', function (response) {
	  var body = "";
    response.setBodyEncoding("utf8");
		response.addListener('data', function (chunk) {
			body += chunk;
	  });

		response.addListener('end', function() {
      var callback = 
      function(feed) {
        var hubUri = feed.getLinksByRel('hub')[0];
        var callbackUri = url.parse(subscriber.createCallbackUri());
        subscriber.subscribe(topicUri, hubUri, callbackUri,
          function() {
            topicEvents.emit('subscribed', topicUri.href);
            subscriber.registerEventEmitter(topicUri, topicEvents);
          },
          function(error) {
            topicEvents.emit('error', error);
          });
      };
      sys.puts('callback: ' + callback);
      atom.parse(body, callback);
    });
  });
  topicRequest.close();

  return topicEvents;
}

Subscriber.prototype.registerEventEmitter = function(topicUri, topicEvents) {
  // TODO: make this be a collection of event emitters instead of a single one.
  this.topicEventEmitters[topicUri.href] = topicEvents;
}

/**
 * You have to call this method to start listening for subscription
 * confirmation and update requests from hubs.
 */
Subscriber.prototype.startCallbackServer = function() {
  // start the server waiting for subscription confirmations and
  // feed updates.
  sys.puts("starting callback server on port " + this.callbackPort);
  var subscriber = this;
  http.createServer(function (request, response) {
    if (request.method == 'GET') {
      var parsedUrl = url.parse(request.url);
      var paramList = parsedUrl.query.split("&");
      var params = {};
      for (var i=0; i<paramList.length; i++) {
        var p = paramList[i].split("=");
        if (p.length > 1) {
          params[p[0]] = p[1];
        } else {
          params[p[0]] = '';
        }
      }
      sys.puts('hub.challenge: ' + params['hub.challenge']);
      sys.puts('hub.mode: ' + params['hub.mode']);
      sys.puts('hub.topic: ' + params['hub.topic']);
      sys.puts('hub.lease_seconds: ' + params['hub.lease_seconds']);
    
      response.sendHeader(200);
      response.write(params['hub.challenge']);
      response.close();
    } else if (request.method == 'POST') {
      sys.puts("POST from hub");
      var body= '';
      request.setBodyEncoding("utf8");
      request.addListener('data', function(data) {
        body += data;
      });
      request.addListener('end', function() {
        response.sendHeader(200);
        response.close();
        atom.parse(body, function(feed) {
          var topicId = trim(feed.id);
          var events = subscriber.topicEventEmitters[topicId];
          events.emit('update', feed);
        });
      });
    }
  }).listen(this.callbackPort);
}

var Publisher = function() {
  // TODO: Write this :)
};

exports.Publisher = Publisher;

Publisher.prototype.publish = function(atomFeed) {
  // get the hub link from the atomFeed links
  // POST to it
}

function trim(str) {
      return str.replace(/^\s+|\s+$/g,"");
}

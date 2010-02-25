var sys = require('sys'),
  fs = require('fs'),
	sax = require("./sax"),
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
    this.verify = 'async';
  } else {
    this.verify = 'sync';
  }

  this.topicEventEmitters = {};
};

exports.Subscriber = Subscriber;

Subscriber.prototype.createCallbackUri = function() {
  return "http://localhost:" + this.callbackPort + "/";
};

Subscriber.prototype.subscribe = function(topicUri, hubUri, callbackUri) {
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
    sys.puts(hubUri.href);
    sys.puts(requestBody);

    var promise = new process.Promise();
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
          promise.emitSuccess();
			  } else if (response.statusCode == 204) {
          // No-Content means success for a sync sub.
          promise.emitSuccess();
			  } else {
			    // Any other response code is an error.
			    promise.emitError(body)			    
			  }
			})
		});

		hubRequest.write(requestBody);
		hubRequest.close();

		return promise;
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
	sys.puts('fetching ' + topicHost + ":" + topicPort + topicPath);
  
  var topicClient = http.createClient(topicPort, topicHost);
  var topicRequest = topicClient.request("GET", topicPath, {"Host": topicHost});
  var topicEvents = new events.EventEmitter();

  topicRequest.addListener('response', function (response) {
	  var body = "";
    response.setBodyEncoding("utf8");
		response.addListener('data', function (chunk) {
		  //sys.puts("data: " + chunk);
			body += chunk;
	  });

		response.addListener('end', function() {
      sys.puts("end");
      var atomPromise = atom.parse(body);
      atomPromise.addCallback(function(feed) {
        sys.puts("Feed: " + feed.title)
        var hubUri = feed.getLinksByRel('hub')[0];
        sys.puts("hub: " + hubUri.href);
        // TODO: undo this
        hubUri = url.parse('http://localhost:8086/subscribe');
        topicUri = url.parse('http://localhost/foo');

        var callbackUri = url.parse(subscriber.createCallbackUri());
        sys.puts('callback: ' + subscriber.createCallbackUri());
        var subPromise = subscriber.subscribe(topicUri, hubUri, callbackUri);
        subPromise.addCallback(function() {
          topicEvents.emit('subscribed', topicUri.href);
          subscriber.registerEventEmitter(topicUri, topicEvents);
        });
        subPromise.addErrback(function(error) {
          topicEvents.emit('error', error);
        })
      })
    });
  });
  topicRequest.close();
  /*
  var subscribePromise = this.subscribe(topicUri, hubUri, callbackUri);
  // TODO: fetch hub URI from the atom feed at topicUri instead of 
  // assuming the specified hub works for the topicUri.
  
  subscribePromise.addCallback(function() {
    this.registerEventEmitter(topicUri, topicEvents);
  });
  subscribePromise.addErrback(function(body) {
    topicEvents.emit('error', body);
  })
  */
  return topicEvents;
}

Subscriber.prototype.registerEventEmitter = function(topicUri, topicEvents) {
  sys.puts('registering listener for topic: [' + topicUri.href + ']');
  // TODO: make this be a collection of event emitters instead of a single one.
  this.topicEventEmitters[topicUri.href] = topicEvents;
}

/**
 * You have to call this method to start listening for subscription
 * confirmation and update requests from hubs.
 */
Subscriber.prototype.startServer = function() {
  // start the server waiting for subscription confirmations and
  // feed updates.
  sys.puts("starting server on port " +this.callbackPort);
  var subscriber = this;
  http.createServer(function (request, response) {
    sys.puts("REQ: " + request.url);
    sys.puts("method: " + request.method);
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
      var body= '';
      request.setBodyEncoding("utf8");
      request.addListener('data', function(data) {
        body += data;
      });
      request.addListener('end', function() {
        sys.puts("UPDATE: " + body);
        response.close();
        var atomPromise = atom.parse(body);
        atomPromise.addCallback(function(feed) {
          var topicId = trim(feed.id);
          sys.puts("feed ID: [" + topicId + ']');
          var events = subscriber.topicEventEmitters[topicId];
          sys.puts('events: ' + events);
          events.emit('update', feed);
        });
      });
    }
  }).listen(this.callbackPort);

  // This is just for testing purposes, to have a dummy Atom feed
  // that always has 'updates' ready.
  http.createServer(function (request, response) {
    var uri = request.uri;
    sys.puts("REQ: " + request.url);
    response.sendHeader(200);
    var nowStr = new Date().toISO8601String();
    response.write('\
    <feed xmlns="http://www.w3.org/2005/Atom"\
          xml:lang="en"\
          xml:base="http://www.example.org">\
      <id>http://localhost/foo</id>\
      <title>My Simple Feed</title>\
      <updated>' + nowStr + '</updated>\
      <link href="/foo" />\
      <link rel="self" href="/foo" />\
      <entry>\
        <id>http://www.example.org/entries/1</id>\
        <title>A simple blog entry</title>\
        <link href="foo/entries/1" />\
        <updated>' + nowStr + '</updated>\
        <summary>This is a simple blog entry</summary>\
      </entry>\
    </feed>\
    ');
    response.close();
  }).listen(80);
}

function trim(str) {
      return str.replace(/^\s+|\s+$/g,"");
}

//////

Date.prototype.toISO8601String = function (format, offset) {
    /* accepted values for the format [1-6]:
     1 Year:
       YYYY (eg 1997)
     2 Year and month:
       YYYY-MM (eg 1997-07)
     3 Complete date:
       YYYY-MM-DD (eg 1997-07-16)
     4 Complete date plus hours and minutes:
       YYYY-MM-DDThh:mmTZD (eg 1997-07-16T19:20+01:00)
     5 Complete date plus hours, minutes and seconds:
       YYYY-MM-DDThh:mm:ssTZD (eg 1997-07-16T19:20:30+01:00)
     6 Complete date plus hours, minutes, seconds and a decimal
       fraction of a second
       YYYY-MM-DDThh:mm:ss.sTZD (eg 1997-07-16T19:20:30.45+01:00)
    */
    if (!format) { var format = 6; }
    if (!offset) {
        var offset = 'Z';
        var date = this;
    } else {
        var d = offset.match(/([-+])([0-9]{2}):([0-9]{2})/);
        var offsetnum = (Number(d[2]) * 60) + Number(d[3]);
        offsetnum *= ((d[1] == '-') ? -1 : 1);
        var date = new Date(Number(Number(this) + (offsetnum * 60000)));
    }

    var zeropad = function (num) { return ((num < 10) ? '0' : '') + num; }

    var str = "";
    str += date.getUTCFullYear();
    if (format > 1) { str += "-" + zeropad(date.getUTCMonth() + 1); }
    if (format > 2) { str += "-" + zeropad(date.getUTCDate()); }
    if (format > 3) {
        str += "T" + zeropad(date.getUTCHours()) +
               ":" + zeropad(date.getUTCMinutes());
    }
    if (format > 5) {
        var secs = Number(date.getUTCSeconds() + "." +
                   ((date.getUTCMilliseconds() < 100) ? '0' : '') +
                   zeropad(date.getUTCMilliseconds()));
        str += ":" + zeropad(secs);
    } else if (format > 4) { str += ":" + zeropad(date.getUTCSeconds()); }

    if (format > 3) { str += offset; }
    return str;
}
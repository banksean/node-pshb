var sys = require('sys'),
  fs = require('fs'),
  path = require("path"),
  http = require("http"),
	events = require("events"),
	url = require("url"),
	pshb = require("./lib/pshb-client"),
	webfinger = require("./lib/webfinger-client");
	
var callbackPort = 4443;

var subscriber = new pshb.Subscriber(callbackPort);
subscriber.startServer(); // Start listening for subscription confirmation callbacks.


var hubUri = url.parse("http://localhost:8086/subscribe");
var topicUri = url.parse("http://www.blogger.com/feeds/3462658744634470242/posts/default");
//var callbackUri = url.parse("http://pubsubhubbub-subscriber.appspot.com/subscriber.banksean");
/*
var callbackUri = url.parse(subscriber.createCallbackUri());

var subscribePromise = subscriber.subscribe(topicUri, hubUri, callbackUri);

subscribePromise.addCallback(function() {
  sys.puts('success');
});

subscribePromise.addErrback(function(msg) {
  sys.puts('ERROR');
  sys.puts(msg);
  sys.puts('');
});
*/

var feedEvents = subscriber.listen(url.parse("http://www.blogger.com/feeds/3462658744634470242/posts/default"));
feedEvents.addListener('subscribed', 
  function(feed) {
    sys.puts('subscribed: ' + feed);
  });

feedEvents.addListener('error', 
  function(error) {
    sys.puts('ERROR: ' + error);
  });

feedEvents.addListener('update',
  function(atomFeed) {
    sys.puts('update: ' + atomFeed)
  }
);
  
  
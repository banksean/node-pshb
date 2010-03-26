var sys = require('sys'),
  fs = require('fs'),
  path = require("path"),
  http = require("http"),
	events = require("events"),
	url = require("url"),
	pshb = require("./lib/pshb-client");

var callbackPort = 4443;

var subscriber = new pshb.Subscriber(callbackPort);
subscriber.startCallbackServer(); // Start listening for subscription confirmation callbacks.

var topicUri = url.parse("http://localhost/foo"); // Dummy feed, created below.

var feedEvents = subscriber.listen(topicUri);

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
    sys.puts('got a PubSubHubub update: ' + atomFeed.id);
  }
);

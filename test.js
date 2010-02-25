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

// Set up a dummy feed that's always got "updates"
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
    <link rel="hub" href="http://localhost:8086/subscribe" />\
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

////// js dates. meh.

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
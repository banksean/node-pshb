# node-PubSubHubub

A [PubSubHubub](http://code.google.com/p/pubsubhubbub/) client for [node](http://nodejs.org/). 

This is currently just the Subscriber client, no publishing interface yet.  It takes care of starting up an http listener for hub callbacks to handle subscription confirmation and update delivery.  It also parses the atom feed of the topic URI to automatically discover the hub for you.

You just give it a topic URI and some callbacks for events that you care about on that feed and it handles the rest.

## Usage
    var callbackPort = 4443;
    var subscriber = new pshb.Subscriber(callbackPort);
    subscriber.startCallbackServer(); // Start listening for subscription confirmation callbacks.

    var topicUri = url.parse("http://localhost/foo"); 

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

## Example app

First you'll need to run a local PubSubHubbub hub.  I recommend getting the one from [code.google.com](http://code.google.com/p/pubsubhubbub/) and running it with AppEngine Launcher.

Start it up on port 8086 (or change the demo feed in test.js to point to another port for the feed's hub).

Then from the top level directory of this project, run 

    $ node test.js

This starts up the hub callback listener, starts a demo feed on port 80 and requests a subscription to that feed via the hub you started in the previous step.

Next you have to tell the hub that the feed has updated.  Normally this would be taken care of by your blogging software and wouldn't require a manual step.  Go to http://localhost:8086/publish and publish http://localhost/foo.  You might have to go through http://localhost:8086/_ah/admin/queues and clear out feed-pulls and event-delivery queues. Then the demo app should have output the line "got a PubSubHubub update: http://localhost/foo" to stdout.

## TODO

Async subscription confirmations

Multiple listeners per topic URI

Persist records of subscriptions instead of re-requesting them every time on startup

Make a demo publisher app so you don't have to go through the AppEngine dev console to update the feed
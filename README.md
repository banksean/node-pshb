# node PUbSubHubub

An [PubSubHubub]() client for [node](http://nodejs.org/). 


## Usage

    var wf = new webfinger.WebFingerClient();
    var userUri = "foo@example.com";
    var fingerPromise = wf.finger(userUri);
    fingerPromise.addCallback(function(xrdObj) {
      // Do something with the user's xrd object
    }

## Example app

From the top level directory of this project, run 

    $ node webfinger-buzz.js <username>@gmail.com

and the application will output the latest google public Buzz entry from that user.

## TODO

Fix up the XRD and Atom parsers.  Currently doesn't work on Yahoo's XRD, for example.
Error handling.

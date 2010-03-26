
var sys = require('sys'),
  fs = require('fs'),
	sax = require("../third_party/sax-js/lib/sax"),
  path = require("path"),
  http = require("http"),
	events = require("events"),
	url = require("url");

/**
 * Crude sax-based XRD parser.
 * 
 * Doesn't yet work with Yahoo's weird-looking host-meta XRD:
 *   http://www.yahoo.com/.well-known/host-meta
 * 
 * It doesn't even have a rel="lrdd" Link element.
 *
 * More info on XRD here:
 * http://hueniverse.com/2009/11/xrd-alignment-with-link-syntax/
 *
 * Sean McCullough banksean@gmail.com
 *
 */

var XRD = function() {
	this.links = [];
	this.subject = "";
	this.alias = "";
};

exports.XRD = XRD;

XRD.prototype.getLinksByRel = function(rel) {
	var ret = [];
	for (var i=0; i<this.links.length; i++) {
		var link = this.links[i];
		for (var j=0; j<link.attributes.length; j++) {
			if (link.attributes[j].name == "rel" && link.attributes[j].value == rel) {
				ret.push(link);
			}
		}
	}
	return ret;
}

var XRDLink = function() {
	this.attributes = [];
}

XRDLink.prototype.addAttr = function(name, value) {
	this.attributes.push({'name': name, 'value': value});
}

XRDLink.prototype.getAttrValues = function(name) {
	var ret = [];
	for (var i=0; i<this.attributes.length; i++) {
		var attr = this.attributes[i];
		if (attr.name == name) {
			ret.push(attr.value);
		}
	}
	return ret;
};

var XRDParser = function(strict) {
	this.strict = false; // this sax parser breaks on gmail's webfinger xrd.
};

exports.XRDParser = XRDParser;

XRDParser.prototype.parse = function(data) {
	var parser = sax.parser(this.strict);
	var promise = new events.Promise();
	var xrd = new XRD();
  var currentNodeName = "";
	parser.onerror = function (e) {
		promise.emitError(e);
	};
  
	parser.ontext = function (t) {
		if (currentNodeName == "SUBJECT") {
			xrd.subject += t;
		} else if (currentNodeName == "ALIAS") {
			xrd.alias += t;
		}
	};

	parser.onopentag = function (node) {
		if (node.name == "LINK") {
			var l = new XRDLink;
			for (var attrName in node.attributes) {
				l.addAttr(attrName, node.attributes[attrName]);
			}
			xrd.links.push(l);		
		}
		currentNodeName = node.name;
	};

	parser.onclosetag = function (name) {
		/*
		*/
  };

	parser.onattribute = function (attr) {
		/*
		*/
	};

	parser.onend = function () {
		promise.emitSuccess(xrd);
	};
	
	parser.write(data).close();
	return promise;
};

/*
xml = fs.cat(path.join(__dirname, "google-xrd.xml"));
xml.addCallback(function (xml) {
	var xrdParser = new XRDParser(false);
	var xrdPromise = xrdParser.parse(xml);
	xrdPromise.addCallback(function(xrdObj) {
		var relLinks = xrdObj.getLinksByRel("lrdd");
		
		for (var i=0; i<relLinks.length; i++) {
			sys.puts("rel link");
			var l = relLinks[i];
			for (var j=0; j<l.attributes.length; j++) {
				sys.puts(l.attributes[j].name + ": " + l.attributes[j].value);
			}
			var template = relLinks[i].getAttrValues("template")[0];
			sys.puts("template: " + template);
		}
	});
});
*/

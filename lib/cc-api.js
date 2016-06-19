'use strict';

var Promise = require('bluebird');
var request = require('request');

function CCClient(opts) {
  this.opts = opts;
}

CCClient.prototype.requestCC = function (url) {
  var baseURL = this.opts.COMPLIANCE_SERVER + this.opts.COMPLIANCE_API_PATH;
  var options = {
    url: baseURL + url,
    'auth': {
      'bearer': this.opts.COMPLIANCE_TOKEN
    },
    strictSSL: this.opts.COMPLIANCE_STRICT_CERT
  };
  return new Promise(function (resolve, reject) {
    request.get(options, function (error, response, body) {
      if (error) { return reject(error); }
      if (response.statusCode === 200 && body) {
        resolve(JSON.parse(body));
      } else {
        return reject(body);
      }
    });
  });
};

CCClient.prototype.orgs = function() {
  return this.requestCC('/orgs');
};

CCClient.prototype.users = function  () {
  return this.requestCC('/users');
};

CCClient.prototype.scans = function(org) {
  return this.requestCC('/owners/' + org + '/scans');
};

CCClient.prototype.scan = function(org, id) {
  return this.requestCC('/owners/' + org + '/scans/' + id);
};

CCClient.prototype.scan_nodes = function(org, id) {
  return this.requestCC('/owners/' + org + '/scans/' + id + '/nodes');
};

module.exports = CCClient;

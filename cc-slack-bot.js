'use strict';

var _ = require('lodash');
var CCClient = require('./lib/cc-api');
var moment = require('moment');

// slack imports
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;

if (!process.env.COMPLIANCE_SERVER) {
    console.log('Error: Specify Chef Compliance Server URL in environment COMPLIANCE_SERVER');
    process.exit(1);
}

if (!process.env.COMPLIANCE_TOKEN) {
    console.log('Error: Specify Chef Compliance access token in environment COMPLIANCE_TOKEN');
    process.exit(1);
}

if (!process.env.COMPLIANCE_ORGS) {
    console.log('Error: Specify organizations in environment COMPLIANCE_ORGS');
    process.exit(1);
}

if (!process.env.SLACK_CHANNEL) {
    console.log('Error: Specify organizations in environment SLACK_CHANNEL');
    process.exit(1);
}

// read orgs
var COMPLIANCE_SERVER = process.env.COMPLIANCE_SERVER;
var COMPLIANCE_ORGS = process.env.COMPLIANCE_ORGS.split();
var SLACK_CHANNEL = process.env.SLACK_CHANNEL;
var SLACK_CHANNEL_ID = null;

// initialize Chef Compliance API Client
var ccclient = new CCClient({
  COMPLIANCE_TOKEN: process.env.COMPLIANCE_TOKEN,
  COMPLIANCE_SERVER: COMPLIANCE_SERVER,
  COMPLIANCE_API_PATH: '/api',
  COMPLIANCE_STRICT_CERT: false
});

// initialize Slack RTM
var token = process.env.SLACK_TOKEN || '';
var rtm = new RtmClient(token, {logLevel: 'debug'});
rtm.start();

// Responds to a message with a 'hello' DM
rtm.on(RTM_EVENTS.MESSAGE, function(message) {
  var user = rtm.dataStore.getUserById(message.user);
  var dm = rtm.dataStore.getDMByName(user.name);
  rtm.sendMessage('Hello ' + user.name + '!', dm.id);
});

rtm.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
  var channel = rtm.dataStore.getChannelOrGroupByName(SLACK_CHANNEL);
  SLACK_CHANNEL_ID = channel.id;
  if (SLACK_CHANNEL_ID == null) {
    console.log('Could not find Slack channel ' + SLACK_CHANNEL);
  } else {
    console.log('Found Slack channel ' + SLACK_CHANNEL);
  }
});

// stores scans that have been sent
var scans = [];
var starttime = moment();

// loop to pull scans from Chef Compliance
var CronJob = require('cron').CronJob;
new CronJob('*/30 * * * * *', function() {
  _(COMPLIANCE_ORGS).each(function(org){
    watchForChange(org);
  });
}, null, true, 'America/Los_Angeles');

function watchForChange(org) {
  ccclient.scans(org).then(function (result) {
    _(result).forEach(function(scan){
      var id = scan.id;
      // check is scan is already handled and if it was executed in the past
      if (scans[id] !== true) {
        ccclient.scan(org, id).then(function (result) {
          // only show completed scans  and the scan occured after starttime
          if (moment(scan.end).isSameOrAfter(scan.start) && starttime.isBefore(scan.end)) {
            console.log('found new scan: ' + id);
            var m = genMessage(result);
            // sent message
            rtm.sendMessage(m, SLACK_CHANNEL_ID);
            scans[id] = true;
          } else if (starttime.isAfter(scan.end)) {
            // mark the scan as checked
            scans[id] = true;
          }
        });
      }
    });
  }).catch(function (e) {
    console.log(e);
  });
}

function genMessage(scan) {
  var state = ':white_check_mark:';
  if (scan.complianceSummary.critical > 0 || scan.failedCount > 0) {
    state = ':x:';
  } else if (scan.complianceSummary.major > 0){
    state = ':exclamation:';
  }

  var msg = state + ' Scan finished with ' +
      scan.complianceSummary.success + ' successful, ' +
      scan.complianceSummary.critical + ' critical, ' +
      scan.complianceSummary.major + ' major, ' +
      scan.complianceSummary.skipped + ' skipped tests for ' + scan.nodeCount + ' nodes';

  if (scan.failedCount > 0) {
    msg += ' ' + scan.failedCount + 'Unreachable';
  }

  msg += ' ' + COMPLIANCE_SERVER + '/#/analytics/scans/' + scan.id;
  return msg;
}

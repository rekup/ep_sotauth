var ERR = require("async-stacktrace");

var settings = require('ep_etherpad-lite/node/utils/Settings');
var exp = require('ep_etherpad-lite/node_modules/express');
var authorManager = require("ep_etherpad-lite/node/db/AuthorManager");

/* sotauthUsername is set by authenticate and used in messageHandler, keyed on express_sid */
var sotauthUsername = {};
var mySotAuthOpts = {};

async function sotauthSetUsername(token, username) {
      console.debug('ep_sotauth.sotauthSetUsername: getting authorid for token %s', token);
      let author_promise = authorManager.getAuthor4Token(token);
      let author = await author_promise;
    	if(author) {
      	console.debug('ep_sotauth.sotauthSetUsername: have authorid %s, setting username to %s', author, username);
    	  authorManager.setAuthorName(author, username);
    	} else {
    	  console.debug('ep_sotauth.sotauthSetUsername: could not get authorid for token %s', token);
    	}
      return;
}


exports.authenticate = function(hook_name, context, cb) {
  console.debug('ep_sotauth.authenticate');
  mySotAuthOpts.usernameHeader = (typeof settings.users.sotauth === 'undefined' || typeof settings.users.sotauth.usernameHeader === 'undefined') ? 'x-forwarded-user' : settings.users.sotauth.usernameHeader;
  mySotAuthOpts.displaynameHeader = (typeof settings.users.sotauth === 'undefined' || typeof settings.users.sotauth.displaynameHeader === 'undefined') ? 'x-forwarded-user' : settings.users.sotauth.displaynameHeader;
  if (context.req.headers[mySotAuthOpts.usernameHeader]) {
    var username = context.req.headers[mySotAuthOpts.usernameHeader];
    var displayName = context.req.headers[mySotAuthOpts.displaynameHeader] || username;
    var express_sid = context.req.sessionID;
    console.debug('ep_sotauth.authenticate: have %s = %s for express_sid = %s', mySotAuthOpts.usernameHeader, username, express_sid);
    context.req.session.user = username;
    if (settings.users[username] == undefined) settings.users[username] = {};
    settings.users[username].username = username;
    settings.globalUserName = username;
    sotauthUsername[express_sid] = displayName;
    return cb([true]);
  } else {
    console.debug('ep_sotauth.authenticate: have no x-forwarded-user for express_sid = %s', express_sid);
    return cb([false]);
  }
}


exports.handleMessage = function(hook_name, context, cb) {
  console.debug("ep_sotauth.handleMessage");
  if( context.message.type == "CLIENT_READY" ) {
    if(!context.message.token) {
      console.debug('ep_sotauth.handleMessage: intercepted CLIENT_READY message has no token!');
    } else {
      var client_id = context.client.id;
      var express_sid = context.client.client.request.sessionID;
      console.debug('ep_sotauth.handleMessage: intercepted CLIENT_READY message for client_id = %s express_sid = %s, setting username for token %s to %s', client_id, express_sid, context.message.token, sotauthUsername);
      sotauthSetUsername(context.message.token, sotauthUsername[express_sid]);
    }
  } else if( context.message.type == "COLLABROOM" && context.message.data.type == "USERINFO_UPDATE" ) {
    console.debug('ep_sotauth.handleMessage: intercepted USERINFO_UPDATE and dropping it!');
    return cb([null]);
  }
  return cb([context.message]);
}


exports.expressConfigure = function(hook_name, context, cb) {
  console.debug('ep_sotauth.expressConfigure: setting trust proxy');
  context.app.enable('trust proxy');
}



exports.authorize = function(hook_name, context, cb) {
  console.debug('ep_sotauth.authorize');
  if (context.resource.match(/^\/(static|javascripts|pluginfw|favicon.ico|api)/)) {
    console.debug('ep_sotauth.authorize: authorizing static path %s', context.resource);
    return cb([true]);
  } else {
    console.debug('ep_sotauth.authorize: passing authorize along for path %s', context.resource);
    if (context.req.session.user !== undefined) {
        return cb([true]);
    } else {
        return cb([false]);
    }
  }
}

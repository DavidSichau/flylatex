/**
 * Module dependencies.
 * app.js -
 * entry to express app.
 *
 */

var express = require('express')
, engine = require('ejs-locals')
, sharejs = require('share').server
, routes = require('./routes') 
, configs = require('./configs')
, global = require("./routes_lib/global")
, http = require('http')
, MongoStore = require('connect-mongo')(express);


var app = express();
var server = http.createServer(app);
global.io = require("socket.io").listen(server, {log:false});






// Global server Configuration
app.configure(function(){
    app.engine('ejs', engine);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({
	    secret: "788e6139b25d14de5eecc7fc14bd65529218e8cc",
        store: new MongoStore(configs.db),
        maxAge: 24 * 60 * 60 * 1000// max age of session is one day
    }));
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
    
    
    app.locals({
      _layoutFile: true
    })
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    var edt = require('express-debug');
    edt(app, {panels: ['nav','locals', 'request', 'session', 'template', 'software_info', 'profile']});
});

app.configure('production', function(){
    app.use(express.errorHandler());
});


// ========= ShareJS configuration ============
// attach the sharejs REST and socket.io interfaces to the server
var sharejsOptions = {db: {type: 'none'}};

sharejs.attach(app, sharejsOptions);


/**
 * Routes
 */
app.post('/', routes.preIndex, routes.index); 
app.get('/', routes.preIndex, routes.index);
app.del('/', routes.logOutUser, routes.index);

// for signing up on site
app.get('/signup', routes.displaySignUpForm);
app.post('/signup', routes.processSignUpData);

// for creating a new document
app.put('/createdoc', routes.isUserLoggedIn, routes.createDoc);

app.post('/createSubDoc', routes.isUserLoggedIn, routes.createSubDoc);

// for deleting a document
app.del('/deletedoc', routes.isUserLoggedIn, routes.deleteDoc);

// for sharing access to a document
app.post('/shareaccess', routes.isUserLoggedIn, routes.shareAccess);

// for requesting access to a document
app.post('/requestaccess', routes.isUserLoggedIn, routes.requestAccess);

// for requesting auto-complete data
app.get('/autocomplete', routes.ajaxAutoComplete); 

// for getting messages for a user
app.get('/showmessages', routes.isUserLoggedIn, routes.getMessages);

// for granting access to a document
app.post('/grantaccess', routes.isUserLoggedIn, routes.grantAccess);

// for accepting invitation to have access to a document
app.post('/acceptaccess', routes.isUserLoggedIn, routes.acceptAccess);

// add a new document to my list of sessions
app.post('/adddoctosession', routes.isUserLoggedIn, routes.addNewDocument);

// reload the documents in the session of the current user
app.post('/reloadsession', routes.isUserLoggedIn, routes.reloadSession);

// delete a message
app.post('/deletemessage', routes.isUserLoggedIn, routes.deleteMessage);

// load a document
app.get('/document/:documentId', routes.isUserLoggedIn, routes.openDocument);

// save the text for a document
app.post('/savedoc',routes.isUserLoggedIn, routes.saveDocument);

// compile the latex document
app.post('/compiledoc',routes.isUserLoggedIn, routes.compileDoc);

// for serving pdf's for documents with specific id's
app.get('/servepdf/:projectId',routes.isUserLoggedIn, routes.servePDF);


/** end of ROUTES */


// open a port for this server
server.listen((process.env.PORT || 3000), function(){
    console.log("Express server listening on port %d in %s mode", server.address().port, app.settings.env);
});


exports.server = server;
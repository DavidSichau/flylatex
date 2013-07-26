/*
 *  Define all routes here for the fly-latex application.
 *  
 */

var mongoose = require("mongoose")
, Schema = mongoose.Schema
, ObjectId = Schema.ObjectId
, app= require("./app")
, global = require("./routes_lib/global")



// load configurations here
, configs = require("./configs")

, temp = require("temp")
, fs = require("fs-extra")
, util = require("util")
, path = require("path")
, exec = require("child_process").exec
, http = require("http")

// flylatex directory
, flylatexdir = __dirname;

// connect to the flydb app db
mongoose.connect(configs.db.url);

require("./models"); // import the models here

// import the models here
var User = mongoose.model("User")
, Document = mongoose.model("Document")
, DocPrivilege = mongoose.model("DocPrivilege")
, Project = mongoose.model("Project")
, Message = mongoose.model("Message")
, PDFDoc = mongoose.model("PDFDoc");

// laod helpers here
var helpers = require("./routes_lib/helpers.js");

// import some route definitions
exports.index = require("./routes_lib/index.js").index;
exports.logOutUser = require("./routes_lib/logout.js").logOutUser;
exports.displaySignUpForm = require("./routes_lib/displaysignup.js").displaySignUpForm;
exports.addNewDocument = require("./routes_lib/addnewdocument.js").addNewDocument;



// ================ GLOBAL variables here =============

// maximum number of documents a user can have
var MAX_DOCS = ( configs.docs.MAX_NUM_PER_USER > 0 ? configs.docs.MAX_NUM_PER_USER : 20 );

// messageTypes
var MESSAGE_TYPES = {
    'requestAccess': 0
    , 'shareAccess': 1
};

// currently opened documents
// map of docId : [username]
var openDocuments = {};

// ==================================================


/*
 * About rendering:
 * the object to pass to the template being rendered has to have:
 * ===== title ======
 * ===== shortTitle ======
 * Optionally can have:
 * * fileSpecificScript
 * * fileSpecificStyle
 * * currentUser
 * * isLoggedIn (should always go together with currentUser)
 * * tagLine
 * * currentDoc
 * * userDocuments - this is an abstraction of the real Document model.
     So it contains different attributes.
     contains: id, name, readAccess, writeAccess, execAccess, canShare, subDocs [id, name]
 * * errors
 * * infos
*/


/*
 * preIndex -
 * load currentUser's data before loading page
 * if user's not registered, just go to next
 * @param req -> request object
 * @param res -> response object
 * @param next -> next (middleware) function (in callchain) to execute
 */
exports.preIndex = function(req, res, next) {
    console.log("pre index called");
    if ((req.body.username == undefined && req.body.password == undefined) || (req.body.username.length == 0 && req.body.password.length == 0)) {
        // user's chilling, makes no attempt to log in
        next();

        // seperated the two conditions to make things
        // a lil bit clearer

    }
    else if (req.session.currentUser && req.session.isLoggedIn) {
        // user's already logged in, so go on
        next();
    }
    else if (req.body.username && req.body.username.length > 0 && req.body.password && req.body.password.length > 0) {

        // user's not logged in, but wants to log in
        User.findOne({
            userName: req.body.username
        }, function(err, user) {
            if (err) {
                console.log("error: ");
                console.log(err);
                req.session.currentUser = null;
                req.session.isLoggedIn = false;
                next();
                return;
            }

            if (!user || typeof user.authenticate != "function") {
                // is user even in db ? 
                req.session.errorMessage = "There's no user called " + req.body.username + " in our database";
                res.redirect('back');
                return;
            }
            else if (!user.authenticate(req.body.password)) {
                // user's password incorrect
                req.session.errorMessage = "Password does not match Username entered";
                res.redirect('back');
                return;
            }
            else {
                // authenticate user against password entered
                console.log("==========user successfully logged in========");
                console.log(user);
                console.log("=============================================");

                // user authenticated! Can go in
                helpers.loadUser(user, function(err, loadedUser) {
                    console.log("loaded user " + loadedUser.currentUser)
                    for (var key in loadedUser) {
                        req.session[key] = loadedUser[key];
                    }

                    next();

                });
            }
        });
    }
    else {
        // user's trying to log in, but didn't enter both username
        // and password
        if (!(req.body.username && req.body.password)) {
            req.session.infoMessage =  "Enter both a username and password";
            res.redirect('back');
            return;
        }
    }
};



/*
 * processSignUpData ->
 *  processes the sign up data posted from the sign
 *  up form and logs the user into fly latex
 *  , redirecting him to his home page.
 * @param req -> request object
 * @param res -> response object
 */
exports.processSignUpData = function(req, res) {
    var errors = {}; // key-value pair -> error Type : error Message
    var isError = false;
    var newUser = req.body.newUser;

    // validate userName: make sure no one else has that username
    if (newUser.userName.length == 0) {
	errors["userNameToken"] = "Enter a username";
    }

    // make sure valid password
    if (!(newUser.password.length > 4 // password has to be at least 5 chars 
	  && /\d+/.test(newUser.password))) { // password has to have at least one digit
	errors["passwordInvalid"] = "Password must be at least 5 chars and must contain at least one digit";
	isError = true;
    }

    // make sure password == confirmPassword
    if (newUser.password != newUser.confirmPassword) {
	errors["passwordNoMatch"] = "The Confirm Password should match the initial password entry";
	isError = true;
    }


    // make sure email is valid
    if (!(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(newUser.email))) {
	errors["emailInvalid"] = "Enter a valid email address";
	isError = true;
    }

    // make sure names are valid
    if (!(newUser.firstName.length > 0
	  && newUser.lastName.length > 0)) {
	errors["namesInvalid"] = "Enter a first Name and a Last Name";
	isError = true;
    }

    // optional params
    if (newUser.githubId.length == 0) {
	delete newUser["githubId"];
    }
    if (newUser.twitterId.length == 0) {
	delete newUser["twitterId"];
    }
    
    if (!isError) {
        // there's no error. Save the new user
        // only if someone else doesn't have his username
        User.find({
            userName: newUser.userName
        }, function(err, users) {
            if (users.length > 0) {
                errors["userNameTaken"] = "The username " + newUser.userName + " is already taken";
                isError = true;

                helpers.displayErrorsForSignUp(res, errors);
            }
            else {
                // save the user
                var newFlyUser = new User();
                for (var key in newUser) {
                    newFlyUser[key] = newUser[key];
                }
                newFlyUser.documentsPriv = [];
                newFlyUser.save(function(err) {
                    if (err) {
                        console.log("==============Error in saving user======");
                    }
                    else {
                        console.log("================saved user=============");
                    }
                    console.log(newFlyUser);
                    console.log("======================================");
                });

                // load user here
                helpers.loadUser(newFlyUser, function(err, loadedUser) {
                    for (var key in loadedUser) {
                        req.session[key] = loadedUser[key];
                    }
                    // redirect to home page with user
                    // logged in and ready to rumble!
                    res.redirect("home");
                });

            }
        });
    } else {
	// there's an error. Return error message(s) to user
	helpers.displayErrorsForSignUp(res, errors);
    }
};


exports.createSubDoc = function(req, res) {
    console.log("createSubDoc called");
    var response = {
        infos: [],
        errors: [],
        code: 200,
        newSubDocument: {
            projectId: req.body.projectId,
            id:  null,
            name: null
        }
    };    
    
    var docName = req.body.docName;
    var projectId= req.body.projectId;
    
    if (!(docName.length && docName.length > 0)) {
        // check that document's name is not empty
        response.errors.push("Error in creating document with no title or name");
        res.json(response);
        return;
    }
    else if (!(req.session.isLoggedIn && req.session.currentUser)) {
        // user is not logged in
        response.errors.push("You're not not logged in. Please log in!");
        res.json(response);
        return;
    }
    else if(projectId=== undefined || projectId=== "") {
        response.errors.push("You need to select an master document to create a new sub document!");
        res.json(response);
        return;
    }
    
    
    // check the list of documents
    // verify that this new document doesn't
    // have the same name as the old ones
    var found = false;
    for (var i = 0; i < req.session.userDocuments.length; i++) {
        if (req.session.userDocuments[i].name == docName) {
            found = true;
            break;
        }
    }
    if (found) {
        response.errors.push("Error in creating document that shares its name with an already existing document you have.");
        res.json(response);
        return;
    }
    else {
        // then check that the user doesn't have up to MAX_DOCS documents yet
        if (req.session.userDocuments.length >= MAX_DOCS) {
            response.errors.push("You can't have more than " + MAX_DOCS + " documents. Delete some documents to create space. Or contact the Administrator.");
            res.json(response);
            return;
        }
        else {
            // so we can create a new document 
            // the new document will have only one line for starters
            var newDoc = helpers.createNewDocument(req.body.docName);
            Project.findOne({
                _id: projectId
            }, function(err, project){
                
                if (err || !project) {
                    response.errors.push("error", "Couldn't find the project. Weird.");
                    res.json(response);
                    return;
                }
                
                var newSubDoc = {};
                newSubDoc.id = newDoc._id;
                newSubDoc.name = docName;
                
                //save the new doc
                project.subDocs.push(newSubDoc);
                project.save();
                

                
                //add the subdoc to the session
                for (var i = 0; i < req.session.userDocuments.length; i++) {
                    if (req.session.userDocuments[i].id == project._id) {
                        req.session.userDocuments[i].subDocs.push(newSubDoc);
                    }
                }
                
                //prepare the response    
                newSubDoc.projectId = projectId;
                response.newSubDocument = newSubDoc;
                
                
                
                // inform other users that sub doc is generated
                newSubDoc.generatedByUser = req.session.currentUser;
                global.io.sockets.volatile.emit("addedSubDoc", JSON.stringify(newSubDoc));

                
                
                // inform user of new document creation
                response.infos.push("Just created the new sub Document: " + req.body.docName + " Hooray!");
                res.json(response);
            });    
        }
    }
};



/**
 * createDoc ->
 * creates a new document for the current user.
 * error if user not logged in.
 * @note
 * this function is called asynchronous and should
 * send back a json response
 * and not redirect or reload page.
 *
 * @param req -> request object
 * @param res -> response object
 */
exports.createDoc = function(req, res) {
    // prepare response object
    var response = {
        infos: [],
        errors: [],
        code: 200,
        newDocument: {
            id: null,
            name: null,
            readAccess: true,
            writeAccess: true,
            execAccess: true,
            canShare: true
        }
    };

    var docName = req.body.docName;

    if (!(docName.length && docName.length > 0)) {
        // check that document's name is not empty
        response.errors.push("Error in creating document with no title or name");
        res.json(response);
        return;
    }
    else if (!(req.session.isLoggedIn && req.session.currentUser)) {
        // user is not logged in
        response.errors.push("You're not not logged in. Please log in!");
        res.json(response);
        return;
    }

    // check the list of documents
    // verify that this new document doesn't
    // have the same name as the old ones
    var found = false;
    for (var i = 0; i < req.session.userDocuments.length; i++) {
        if (req.session.userDocuments[i].name == docName) {
            found = true;
            break;
        }
    }
    if (found) {
        response.errors.push("Error in creating document that shares its name with an already existing document you have.");
        res.json(response);
        return;
    }
    else {
        // then check that the user doesn't have up to MAX_DOCS documents yet
        if (req.session.userDocuments.length >= MAX_DOCS) {
            response.errors.push("You can't have more than " + MAX_DOCS + " documents. Delete some documents to create space. Or contact the Administrator.");
            res.json(response);
            return;
        }
        else {
            // so we can create a new document 
            // the new document will have only one line for starters
            var newDoc = helpers.createNewDocument(req.body.docName);
            var newProject = helpers.createNewProject(newDoc, req.session.currentUser);

            // by default, document privilege for the
            // current user is 7 (full access)
            var docPriv = new DocPrivilege();
            docPriv.projectId = newProject._id;

            // new user document to send off to front end for display
            var newUserDocument = {};

            User.findOne({
                "userName": req.session.currentUser
            }, function(err, user) {
                if (err || !user) {
                    response.errors.push("error", "Couldn't find you. Weird.");
                    res.json(response);
                    return;
                }

                console.log("Document Priv Object created===============");
                console.log(docPriv);
                console.log("===========================================");
                // save docPriv
                docPriv.save();

                // add to user's documentsPriv
                user.documentsPriv.push(docPriv._id);

                // save the document
                user.save();

                // add to the user's session data
                newUserDocument.id = newProject._id
                newUserDocument.masterId = newDoc._id
                newUserDocument.name = newProject.name;

                // user creating document should have full access to document
                // R,W,X (and so can share the document with anyone)
                newUserDocument.readAccess = true;
                newUserDocument.writeAccess = true;
                newUserDocument.execAccess = true;
                newUserDocument.canShare = true;
                newUserDocument.subDocs = [];

                req.session.userDocuments.push(newUserDocument);
                response.newDocument = newUserDocument;

                // inform user of new document creation
                response.infos.push("Just created the new Document: " + req.body.docName + " Hooray!");
                res.json(response);
            });
        }
    }
};

/**
 * deleteDoc -
 * delete the document from the user's list of documents
 * both in the session data and on the database (his/her docPrivileges)
 * then delete the document from the Documents collection.
 * 
 * @note
 * this method is called asynchronously and should not redirect the user
 * or reload the page under any circumstances.
 * @param req -> request object
 * @param res -> response object
 */
exports.deleteDoc = function(req, res) {
    console.log("deleteDoc called");
    // response to send back to user after successful deletion (or error)
    var response = {
        errors: [],
        infos: [],
        code: 200
    };

    // get document id,name for document to delete
    var projectId= req.body.projectId;
    var docName = req.body.projectName;

    if (!(req.session.currentUser && req.session.isLoggedIn)) {
        response.errors.push("Weird. Seems like you're not logged in.");
        res.json(response);
        return;
    }
    // remove the document from Users collections
    User.findOne({
        userName: req.session.currentUser
    }, function(err, user) {
        if (err || !user) {
            console.log("unable to delete doc from " + user.userName + "'s list of documents");
            response.errors.push("Had problems processing your deletion. Try again.");
            res.json(response);
            return;
        }


        // change session object to reflect new change in user's documents
        for (var i = 0; i < req.session.userDocuments.length; i++) {
            if (req.session.userDocuments[i].id == projectId) {
                req.session.userDocuments.splice(i, 1);
                console.log("Removed userDocument with id: " + projectId+ " from session object");
            }
        }


        DocPrivilege.find({
            projectId: projectId
        }, function(err, docsPriv) {
            var numberOfDocuments = docsPriv.length;
            var docPrivId = undefined
            //remove docPriv from User and DB
            for (var i = 0; i < user.documentsPriv.length; i++) {
                for (var j = 0; j < docsPriv.length; j++) {
                    if (user.documentsPriv[i].equals(docsPriv[j]._id)) {
                        docPrivId = docsPriv[j]._id;
                        user.documentsPriv.splice(i, 1);
                        console.log("Removed documentsPriv (id= " + docPrivId+ ") from user " + user.userName);
                        docsPriv[j].remove(function(err) {
                            if (!err) console.log("Removed documentPriv (_id= " + docPrivId + ") completely from the database");
                            else console.log("Error while deleting documentPriv (_id= " + docPrivId + ") completely from the database");
                        });
                        //TODO make the break of the loop nicer
                        i = user.documentsPriv.length;
                        j = numberOfDocuments;
                    }
                }
            }
            // save the user
            user.save();
            
            console.log(numberOfDocuments);

            // check if somebody else have the document
            if (numberOfDocuments === 1) {
                Project.findOne({
                    _id: projectId
                }, function(err, project){
                    var docIds = [];
                    docIds.push(project.masterId);
                    for(var i = 0; i< project.subDocs.length; i++){
                        docIds.push(project.subDocs[i].id);
                    }
                    
                    Document.find({
                        _id: {$in: docIds}
                    }, function(err, docs){
                        console.log(docs);
                        
                    }).remove(function(err) {
                        if(!err) console.log("Removed documents (ids: "+docIds+" ) completely from the db");
                        else console.log("Error while deleting documents (ids: " + docIds+ " ) completely from the db");
                    });
                    
                    project.remove(function(err) {
                        if (!err) console.log("Removed project(_id= " + projectId+ ") completely from the database");
                        else console.log("Error while deleting project(_id= " + projectId + ") completely from the database");
                    });
                });
            }
            else {
                // some other user(s) has access to this document
                console.log("Project(id=" + projectId + ") not deleted because some other users still have access to this document");

                // then remove the current userName from the the list of users
                // with share (full) access, if there
                Project.findOne({
                    _id: projectId
                }, function(err, project) {
                    if (!err) {
                        var found = false;
                        var i; // loop variable
                        for (i = 0; i < project.usersWithShareAccess.length; i++) {
                            if (project.usersWithShareAccess[i] == req.session.currentUser) {
                                found = true;
                                break;
                            }
                        }
                        if (found) {
                            project.usersWithShareAccess.splice(i, 1);
                            // save the document
                            project.save();
                        }
                    }
                });
            }
            if (response.errors.length === 0 && docName.length > 0) {
                response.infos.push("Successfully deleted the document " + docName);
                res.json(response);
            }
        });
    });
};

/**
 * shareAccess -> share access to a document
 * @param req -> request object
 * @param res -> response object
 */
exports.shareAccess = function(req, res) {
    console.log("share Access called");
    var response = {
        errors: [],
        infos: [],
        code: 200
    };

    // get share options
    var options = req.body.options;

    var priv = ((options.withReadAccess == "true" ? 4 : 0) + (options.withWriteAccess == "true" ? 2 : 0) + (options.withExecAccess == "true" ? 1 : 0));

    // try to return error messages if any errors found
    if (!(req.session.currentUser && req.session.isLoggedIn)) {
        response.errors.push("You are not logged in. So you can't share access");
    }
    if (priv == 0) {
        response.errors.push("You can't try to share no privilege Dude/Dudette");
    }
    if (!(options.projectId && options.docName && options.userToShare)) {
        response.errors.push("Options passed in are incomplete");
    }
    if (priv < 4) {
        response.errors.push("You should share at least 'Read' privilege");
        res.json(response);
        return;
    }

    User.findOne({
        userName: options.userToShare
    }, function(err, user) {
        if (err) {
            console.log("An error occured");
        }
        if (!user) {
            response.errors.push("The user you want to send a message to doesn't exist");
        }
        if (response.errors.length > 0) {
            // if any errors
            res.json(response);
        }
        else {
            // if no errors found yet
            // make the message to send
            var newMessage = new Message();
            newMessage.messageType = MESSAGE_TYPES.shareAccess;
            newMessage.fromUser = req.session.currentUser;
            newMessage.toUser = options.userToShare;
            newMessage.projectId= options.projectId;
            newMessage.documentName = options.docName;
            newMessage.access = priv;

            // save the message to the messages collection
            newMessage.save();

            var withReadAccess = (options.withReadAccess == 'true'),
                withWriteAccess = (options.withWriteAccess == 'true'),
                withExecAccess = (options.withExecAccess == 'true');

            // send success message
            response.infos.push("You just invited " + options.userToShare + " to have " + (withReadAccess ? "Read" + ((!withWriteAccess && !withExecAccess) ? " " : ", ") : "") + (withWriteAccess ? "Write" + (!withExecAccess ? " " : ", ") : "") + (withExecAccess ? "Exec " : " ") + "Access to " + options.docName);
            // let the recipient of the message know that he has a new
            // message

            global.io.sockets.volatile.emit("newMessage", JSON.stringify(newMessage));


            // send response back to the client
            res.json(response);
        }
    });
};
/**
 * ajaxAutoComplete ->
 * returns json of auto-complete results based on the purpose
 * 
 * @param req -> request object
 * @param res -> response object
 */
exports.ajaxAutoComplete = function(req, res) {
    /*
     * ====data to get ======
     * word -> word to search for
     * purpose -> usernames, and so on.
     */
    // get the purpose of the auto-complete mission
    var purpose = req.query.purpose;
    // get the word to autocomplete for
    var word = req.query.word;
    
    switch (purpose) {
    case "usernames":
	// get word user has typed so far
	var typed = req.query.word
	, data = {code:200, results:[]};
	
	// query the users collection for usernames
	User.find({userName: new RegExp(typed)}, function(err, users) {
	    if (!err) {
		users.forEach(function(item, index) {
		    if (item.userName != req.session.currentUser) {
			data.results.push(item.userName);
		    }
		});
	    }
	    res.json(data);
	});
	break;
    default:
	console.log("It's either you're trying to mess with me or I messed up.");
    };
};

/**
 * requestAccess -> request access to a document
 * @param req -> request object
 * @param res -> response object
 */
exports.requestAccess = function(req, res) {
    var response = {
        errors: [],
        infos: [],
        code: 200
    };

    // get request access options
    var options = req.body.options;

    var priv = ((options.withReadAccess == "true" ? 4 : 0) + (options.withWriteAccess == "true" ? 2 : 0) + (options.withExecAccess == "true" ? 1 : 0));

    // try to return error messages if any errors found
    if (!(req.session.currentUser && req.session.isLoggedIn)) {
        response.errors.push("You are not logged in. So you can't share access");
    }
    if (priv == 0) {
        response.errors.push("You can't try to request for no privilege");
    }
    if (!(options.projectId&& options.docName)) {
        response.errors.push("Options passed in are incomplete");
    }

    if (priv < 4) {
        response.errors.push("You should request for at least read access to a document ");
    }

    if (response.errors.length > 0) {
        res.json(response);
        return;
    }
    // first find the users that have share access (7:R,W,X) to the document
    Project.findOne({
        _id: options.projectId
    }, function(err, project) {
        if (err) {
            console.log("An error occured while trying to request access for " + req.session.currentUser);
        }
        else {
            if (project.usersWithShareAccess.length > 0) {
                var newMessage, i;

                for (i = 0; i < project.usersWithShareAccess.length; i++) {
                    // TODO Check if only one message is stored
                    newMessage = new Message();
                    newMessage.messageType = MESSAGE_TYPES.requestAccess;
                    newMessage.fromUser = req.session.currentUser;
                    newMessage.toUser = project.usersWithShareAccess[i];
                    newMessage.projectId= options.projectId;
                    newMessage.documentName = options.docName;
                    newMessage.access = priv;

                    // save the message in the messages collection
                    newMessage.save();

                    // alert users that are logged in about message
                    global.io.sockets.volatile.emit("newMessage", JSON.stringify(newMessage));

                }
                response.infos.push("Sent a 'Request More Privileges' message to all the users who have share access to the document, " + options.docName);

                res.json(response);
            }
            else {
                response.errors.push("No user currently has Share Access to that document");

                // send response back
                res.json(response);
            }
        }
    });
};

/**
 * getMessages ->
 * get the messages for the current user
 * @param req -> request object
 * @param res -> response object
 *
 * @jsonreturn returns a list of user's messages
 *  each message object is of the form
 *  {messageType:, fromUser:, toUser:, projectId:, documentName:,access:}
 */
exports.getMessages = function(req, res) {
    var response = {
        errors: [],
        infos: [],
        messages: []
    };

    // try to find messages for the current user
    Message.find({
        toUser: req.session.currentUser
    }, function(err, messages) {
        if (err) {
            response.errors.push("Error while retrieving messages. Try again later.");
            res.json(response);
        }
        else if (messages.length === 0) {
            response.infos.push("You have no messages!");
            res.json(response);
        }
        else {
            // get the messages
            messages.forEach(function(item, index) {
                var priv = helpers.getPrivileges(item.access);
                // set privileges fromUser is requesting
                item.readAccess = priv.readAccess;
                item.writeAccess = priv.writeAccess;
                item.execAccess = priv.execAccess;

                response.messages.push(item);
            });

            // send back messages
            res.json(response);
        }
    });
};

/** 
 * grantAccess -> 
 * grant another user access to some document
 * @param req : request object
 * @param res: response object
 */
exports.grantAccess = function(req, res) {
    var response = {
        errors: [],
        infos: []
    }

    console.log("grantAccess called");

    /**
     * options passed in: userToGrant, documentId, documentName, access
     */
    if (!(req.session.currentUser && req.session.isLoggedIn)) {
        response.errors.push("You cannot grant access since you are not logged in.");
        res.json(response);
        return;
    }


    User.findOne({
        userName: req.body.userToGrant
    }, function(err, user) {
        if (err || !user) {
            response.errors.push("No user " + req.body.userToGrant + " exists or an error occured while looking for this user");
            res.json(response);
        }
        else {
            // make sure the user's granting at least read access 
            if (req.body.access < 4) {
                response.errors.push("You should grant a user at least 'Read' privilge");
                res.json(response);
                return;
            }
            var priv = helpers.getPrivileges(parseInt(req.body.access));
            if (priv.canShare) {
                // give user R, W, X access
                helpers.giveUserSharePower(req.body.userToGrant, req.body.projectId);
            }

            // this method either updates or inserts the new object but only if access is larger than current
            DocPrivilege.update({
                _id: {
                    $in: user.documentsPriv
                },
                projectId: req.body.projectId,
                access: {$lt: parseInt(req.body.access)} 
            }, {
                $set: {
                    access: parseInt(req.body.access),
                    documentName: req.body.documentName,
                    projectId: req.body.projectId
                }
            }, {
                upsert: true
            }, function(err, numberUpdated, rawData) {
                if (err) {
                    console.log("Error occured during DocPiv update: " + err);
                    response.infos.push("Error while upgrading privileges, please try again.");
                }
                
                Project.findOne({
                    _id: req.body.projectId
                }, function(err, project) {
                    if (err) {
                        console.log("error: " + err);
                    }
                    var newUserDocument = helpers.loadProject(project, parseInt(req.body.access));

                    if (rawData.updatedExisting) {
                        response.infos.push("You just upgraded the privileges of " + req.body.userToGrant + " for the document " + req.body.documentName);
                    }
                    else {
                        response.infos.push("You just granted " + req.body.userToGrant + "new privileges for the document " + req.body.documentName);
                    }
                    // response.reloadDocs = true;
                    newUserDocument.forUser = req.body.userToGrant;
                    global.io.sockets.volatile.emit("changedDocument", JSON.stringify(newUserDocument));
                    res.json(response);

                });
                

            }); 
        }
    });
};    
/** 
 * acceptAccess ->
 * accept another user's offer to have  
 * access to a document
 * @param req : request object
 * @param res: response object
 */
exports.acceptAccess = function(req, res) {
    console.log("accept Access called");
    var response = {
        errors: [],
        infos: [],
        newDocument: null,
        reDisplay: false,
        userDocuments: req.session.userDocuments
    };

    /**
     * options passed in: acceptFromUser, projectId, documentName, access
     */
    if (!(req.session.currentUser && req.session.isLoggedIn)) {
        response.errors.push("You cannot accept the invitation since you aren't logged in");
        res.json(response);
        return;
    }

    // make sure the privilege to accept is at least read privilege
    if (parseInt(req.body.access) < 4) {
        response.errors.push("You should accept at least 'Read' privilege");
        req.json(response);
    }

    User.findOne({
        userName: req.session.currentUser
    }, function(err, user) {
        // first make sure the user doesn't already have some access to the document
        // in that case, bump up the user's access
        var userHasDoc = false;
        req.session.userDocuments.forEach(function(item, index) {
            if (item.id == req.body.documentId) {
                userHasDoc = true;
            }
        });

        var priv = helpers.getPrivileges(req.body.access);
        // give user power to be able to share the document with other users
        // if he/she has full access
        if (priv.canShare) {
            // give user share power
            // a user can only get share access when he's given access of 7
            // which corresponds to R, W, X
            helpers.giveUserSharePower(req.session.currentUser, req.body.projectId);
        }


        // this method either updates or inserts the new object but only if access is larger than current
        DocPrivilege.update({
            _id: {
                $in: user.documentsPriv
            },
            projectId: req.body.projectId,
            access: {
                $lt: parseInt(req.body.access)
            }
        }, {
            $set: {
                access: parseInt(req.body.access),
                projectId: req.body.projectId}
        }, {
            upsert: true
        }, function(err, numberUpdated, rawData) {
            if (err) {
                console.log("Error occured during DocPiv update: " + err);
                response.infos.push("Error while upgrading privileges, please try again.");
            }
            
            Project.findOne({
                _id: req.body.projectId
            }, function(err, project){
                if(err){
                    console.log("error: "+err);
                }
                var newUserDocument = helpers.loadProject(project, parseInt(req.body.access));
                            
                if (rawData.updatedExisting) {
                    response.infos.push("You just upgraded your rights to the document " + newUserDocument.name);
                    for (var i = 0; i < req.session.userDocuments.length; i++) {
                        if (req.session.userDocuments[i].id == newUserDocument.id) {
                            // upgrade all we've got
                            req.session.userDocuments[i] = newUserDocument;
                        }
                    }
                }
                else {
                    // send acceptance message to user
                    response.infos.push("You just accepted " + (priv.readAccess ? "Read" + ((!priv.writeAccess && !priv.execAccess) ? " " : ", ") : "") + (priv.writeAccess ? "Write" + (!priv.execAccess ? " " : ", ") : "") + (priv.execAccess ? "Exec " : " ") + "Access to " + req.body.documentName + " from " + req.body.acceptFromUser);
                    user.documentsPriv.push(rawData.upserted);
                    user.save();
                    response.newDocument = newUserDocument;
                    req.session.userDocuments.push(newUserDocument);
                }
                response.reDisplay = true;
                res.json(response);
            });
        });
    });

};

/**
 * exports.reloadSession -
 * reload the user's documents and send back the new documents
 *
 * @param req : request object
 * @param res : result object
 */
exports.reloadSession = function(req, res) {
    console.log("reload session called");
    var response = {infos: [], errors: [], userDocuments: null};
    
    if (!(req.session.currentUser && req.session.isLoggedIn)) {
        response.errors.push("You are not logged in.");
        res.json(response);
        return;

    }
    else if (req.session.currentUser == req.body.document.forUser) {
        User.findOne({
            userName: req.session.currentUser
        }, function(err, user) {
            // reload user
            var loadedUser = helpers.loadUser(user, function(err, loadedUser) {
                for (var key in loadedUser) {
                    req.session[key] = loadedUser[key];
                }
                // load userDocuments
                response.userDocuments = req.session.userDocuments;
                console.log(response.userDocuments);
                res.json(response);
            });

        });
    }
    };

/**
 * exports.servePDF ->
 * @param req : request Object
 * @param res : result Object
 *
 */
exports.servePDF = function(req, res) {
    var projectId = req.params.projectId,
        options;

    // find the pdf
    PDFDoc.findOne({
        forDocument: projectId
        }, function(err, doc) {
        if (err || !doc) {
            req.session.errorMessage = "PDF not found or an error occured while reading the pdf";
            res.redirect("back");
            return;
        }
        // write pdf file to user
        fs.createReadStream(configs.pdfs.path + doc.title).pipe(res);
    });
};

/**
 * exports.compileDoc
 * @param req : request object
 * @param res : response object
 */
exports.compileDoc = function(req, res) {
    console.log("compileDoc called");
    // initialize the 'response' JS object to send back
    var response = {infos:[], errors: [], logs:"", compiledDocURI:null};
    var projectId= req.body.projectId;

    if (!(req.session.currentUser && req.session.isLoggedIn)) {
	    response.errors.push("You are not logged in");
	    res.json(response);
	    return;
    } 
    
    
    Project.findOne({
        _id: projectId
    }, function(err, project) {
        if (err || !project) {
            response.errors.push("An Error Occured while trying to open the project");
            res.json(response);
            return;
        }
        var docIds = [project.masterId];
        for (var i = 0; i < project.subDocs.length; i++) {
            docIds.push(project.subDocs[i].id);
        }

        Document.find({
            _id: {
                $in: docIds
            }
        }, function(err, docs) {
            if (err || !docs) {
                response.errors.push("An Error Occured while trying to open the document");
                res.json(response);
                return;
            }
            
            // make temporary directory to create and compile latex pdf
	        temp.mkdir("pdfcreator", function(err, dirPath){
                if (err) {
                    console.log("error:");
                    console.log(err);
                }
                var processed =0;
                for(var i = 0; i < docs.length; i++) {
                    var inputPath = path.join(dirPath, docs[i].name+".tex");
                    var docText = docs[i].data;
                    
                    fs.writeFile(inputPath, docText, function(err) {
                        if (err) {
                            response.errors.push("An error occured even before compiling");
                            res.json(response);
                            return;
                        }
                        //compile pdf should be only called after all files are written
                        if(++processed === docs.length){
                            helpers.compilePdf(dirPath, response, res, project.name, project._id)
                        }
                    });
                }
	        });
        });
    });
    /*
    // first load the text of the document from the database
    Document.findOne({_id:documentId}, function(err, doc) {
	if (err || !doc) {
	    response.errors.push("An Error Occured while trying to open the document");
	    res.json(response);
	    return;
	}

	// get the document text
	var docText = doc.data;

	// make temporary directory to create and compile latex pdf
	temp.mkdir("pdfcreator", function(err, dirPath){
	    var inputPath = path.join(dirPath, documentId+".tex");
	    
	    fs.writeFile(inputPath, docText, function(err) {
		if (err) {
		    response.errors.push("An error occured even before compiling");
		    res.json(response);
		    return;
		}
		process.chdir(dirPath);

		// copy files from the packages folder
		// to the temp directory for compiling
		console.log("From: " + configs.includes.path+"*");
		console.log("To: " + dirPath+"/");
		exec("cp -r " + configs.includes.path+"*  " + dirPath+"/", function(err) {
		    if (err) {
			response.errors.push("Error copying additional packages to use in compilation");
			return;
		    } 
		    // compile the document (or at least try)
		    // redirect the stdin, stderr results of compilation
		    // since the results of compilation will eventually be
		    // written to the log file
		    exec("pdflatex -interaction=nonstopmode "+ inputPath +" > /dev/null 2>&1", function(err) {
			// store the logs for the user here
			fs.readFile(path.join(dirPath, documentId+".log"), function(err, data){
			    if (err) {
				response.errors.push("Error while trying to read logs.");
			    }
			    
			    // store the 'logs' from the compile
			    response.logs = (data ? data.toString() : "");
			    
			    var errorStr = "An error occured before or during compilation";
			    if (err) {
				console.log(err);
				response.errors.push(errorStr);
				res.json(response);
				return;
			    }
			    
			    // store the compile pdf document in the cloud
			    
			    // create new PDFDoc
			    var newpdf = new PDFDoc();
			    newpdf.forDocument = documentId;
			    newpdf.title = documentId+".pdf";
			    tempfile = path.join(dirPath, newpdf.title);
			    fs.copy(tempfile
				    , configs.pdfs.path + newpdf.title
				    , function(err){
					if (err) {
					    console.log(err);
					    response.errors.push(errorStr);
					    res.json(response);
					    return;
					} else {
					    console.log("Successfully saved "+newpdf.title+" in "+configs.pdfs.path);
					    newpdf.save(function(err) {
						if (err) {
						    console.log(err);
						    response.errors.push(errorStr);
						    res.json(response);
						    return;
						}
						response.infos.push("Successfully compiled "+ req.body.documentName);
						// make the compiledDocURI
						response.compiledDocURI = "/servepdf/"+documentId;
						// send response back to user
						res.json(response);
			    		    });
					}
				    });
			});
		    });
		});
	    });
	});
    });
    
    */
};



/**
 * exports.deleteMessage ->
 * delete a message from messages collections
 * @jsonparam -> fromUser
 * @jsonparam -> projectId
 * @jsonparam -> access
 */
exports.deleteMessage = function(req, res) {
    var response = {infos:[], errors:[]};

    if (!(req.session.currentUser && req.session.isLoggedIn)) {
	response.errors.push("Ya not logged in");
	res.json(response);
    } else {
	Message.findOne({fromUser: req.body.fromUser
			 , projectId: req.body.projectId
			 , access: parseInt(req.body.access)
			 , toUser: req.session.currentUser}).remove(function(err) {
	    if (!err) {
		console.log("You just deleted a message");
		
		res.json(response);
	    } else {
		console.log("Error while deleting a message");
	    }
	});
    }
};

/**
 * openDocument ->
 * opens a document
 *
 * @param req : request object
 * @param res : response object
 * 
 * @getparam documentId : id of document to open
 */
exports.openDocument = function(req, res) {
    console.log("open document called");
    // retrieve the document id from url
    var documentId = req.params.documentId;

    // first retrieve the name of the document
    Document.findOne({_id:documentId}, function(err, doc) {
	if (err || !doc) {
        req.session.errorMessage = "An Error Occured while trying to open the document";
	    res.redirect('back');
        console.log("error");
        console.log(err);
	    return;
	}

	// assemble the document lines
	var lastModified
	, userDoc
	, docInSession
	, writeable
	, sharesWith;
	// retrieve the document from the current user session
	docInSession = helpers.searchForDocsInSession(documentId, req.session);	
	// handle lag in findOne callback execution
	if (docInSession == null) {
	    return;
	}
	
	sharesWith = (openDocuments[documentId] ?
		      openDocuments[documentId] : []);

	if (openDocuments[documentId] && openDocuments[documentId].indexOf(req.session.currentUser) == -1) {
	    openDocuments[documentId].push(req.session.currentUser);
	}
	
	// then record that this document is now opened by the current user
	if (!openDocuments[documentId]) {
	    openDocuments[documentId] = [req.session.currentUser];
	}
    
	// construct a user document
	userDoc = {
	    "id" : documentId
        , "projectId" : docInSession.id
        , "projectName" : docInSession.name
	    , "name" : doc.name
	    , "text" : escape(doc.data) // escape special characters
	    , "lastSaved" : doc.lastModified
	    , "sharesWith" : sharesWith
	    , "readAccess" : docInSession.readAccess
	    , "writeAccess" : docInSession.writeAccess
	    , "execAccess" : docInSession.execAccess
	    , "canShare" : docInSession.canShare
	};
	
	// render the document you just opened
	res.render("open-document",{
	    title: "Viewing the document, "+ doc.name
	    , shortTitle: "Fly Latex"
	    , tagLine: "Viewing the document, " + doc.name
	    , fileSpecificStyle: "open-document.css"
	    , fileSpecificScript: "open-document.js"
	    , userDocument: userDoc
	    , currentUser: req.session.currentUser
	    , isLoggedIn: req.session.isLoggedIn
	    , userDocuments: req.session.userDocuments
	});
    });
};




/**
 * saveDocument -
 * saves the document in DB
 *
 * @param req : request object
 * @param res : response object
 */
exports.saveDocument = function(req, res) {
    var response = {
        code: 400,
        errors: [],
        infos: []
    }, documentId = req.body.documentId,
        documentText = req.body.documentText;

    Document.findOne({
        _id: documentId
    }, function(err, doc) {
        var newLine, mb = 1024 * 1024;

        if (err || !doc) {
            response.errors.push("Error in finding document to save");
            res.json(response);
            return;
        }

        // check if documentText length > 15MB (MongoDB doc size limit)
        if (documentText.length > 15 * mb) {
            response.errors.push("This document is 15MB or above. Too large to store.");
            res.json(response);
            return;
        }

        doc.data = new Buffer(documentText);
        doc.lastModified = new Date();

        // save document text
        doc.save(function(err) {
            if (err) {
                console.log("Error while trying to save this document");
            }
        });

        var savedDocMessage = {
            "sharesWith": openDocuments[documentId],
            "lastModified": doc.lastModified
        };

        // send a message to all users that are currently viewing the saved doc
        global.io.sockets.volatile.emit("savedDocument", JSON.stringify(savedDocMessage));

        // after save
        response.code = 200;
        response.infos.push("Successfully saved the document");
        res.json(response);
    });
};

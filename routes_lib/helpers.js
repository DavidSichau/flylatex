/**
 * helpers.js ->
 *  Contains helper functions
 *  that don't take in (req, res)
 */

var mongoose = require("mongoose");
// import 'needed' models here
var Document = mongoose.model("Document");
var DocPrivilege = mongoose.model("DocPrivilege");

/**
 * Helper function to clone an object (deep copy)
 * cloneObject
 * @param obj : object to clone
 */
var cloneObject = function(obj) {
    var clone = {};
    for(var i in obj) {
        if(typeof(obj[i])=="object")
            clone[i] = cloneObject(obj[i]);
        else
            clone[i] = obj[i];
    }
    return clone;
};

/*
 * Helper function to loadUser onto app
 * Returns an object containing user credentials
 * like username and what not.
 */
var loadUser = function(user, callback) {
    var obj = {};

    obj.currentUser = user.userName;
    obj.isLoggedIn = true;
    obj.userDocuments = [];
    obj.userDocumentsPriv = user.documentsPriv;

    // user document to send off to front end for display
    var userDocument = {}, priv;

    loadDocuments(user.documentsPriv, function(err, userDocuments){
        obj.userDocuments = userDocuments;
        callback(false, obj);
    })
}

/*
 * Helper function to load all documents of one user
 * The callback returns as first parameter the error
 * The second parameter is the list of documents
 * THIS METHOD CAN BE SIMPLIFIED
 */
var loadDocuments = function(documentsPriv, callback) {
    var userDocuments = [];
    var count = documentsPriv.length;
    //no documents for the user return
    if(count === 0) callback(false,userDocuments);
    var processed = 0;
    documentsPriv.forEach(function(item, i) {
        DocPrivilege.findOne({
            _id: item
        }, function(err, docPriv) {
            if (err) {
                console.log("error: ");
                console.log(err);
                return;
            }
            if (!docPriv) {
                // is user even in db ? 
                console.log("error", "There's no document with id " + item + " in our database");
                return;
            }
            else {
                var userDocument = {}
                var userDoc = loadDocument(docPriv);
                for (key in userDoc) {
                    userDocument[key] = userDoc[key];
                }
                userDocuments.push(userDocument);
            }
            // make sure that all documents are loaded
            if (++processed == count) {
                callback(false , userDocuments);
            }
        });
    });
    
}



/*
 * Helper function to load on single document from the docPriv
 */
var loadDocument = function(docPriv) {
    var userDocument = {};
    // var priv;
    userDocument.id = docPriv.documentId;
    userDocument.name = docPriv.documentName;
    userDocument.access = docPriv.access;
    
    var priv = getPrivileges(docPriv.access);
    for(var key in priv) {
        userDocument[key] = priv[key];
    }
    return userDocument;
}

/*
 * Helper function to calculate the privileges depeinding on number
 */
var getPrivileges = function(accessCount) {
    var priv_ = accessCount;
    var access = {
        canShare: false,
        readAccess: false,
        writeAccess: false,
        execAccess: false
    };
    
    // if user has R, W, X access, he can share the document
    // else he cannot
    if (priv_ == 7) {
        access.canShare = true;            
    }
    if (priv_ >= 4) {
        access.readAccess = true;
        priv_ -= 4;
    }
    if (priv_ >= 2) {
        access.writeAccess = true;
        priv_ -= 2;
    }
    if (priv_ == 1) {
        access.execAccess = true;
    }
    return access;
}


/*
 * Helper function
 * displayErrorsForSignUp
*/
var displayErrorsForSignUp = function(res, errors) {
    res.render("sign-up",
	       {title: "Sign Up for Fly Latex"
		, shortTitle: "Sign Up"
		, tagLine: "Start Editing Documents with Your Peeps!"
		, fileSpecificStyle: "sign-up.css"
		, fileSpecificScript: "application.js"
		, errors: errors
	       });
};

/**
 * searchForDocsInSession
 * search for document in session.userDocuments
 *
 * @param documentId - id of document to search for
 * @param session - session object for current user
 * @return document
 */
var searchForDocsInSession = function(documentId, session) {
    if (session.userDocuments != undefined) {
        for (var i = 0; i < session.userDocuments.length; i++) {
            if (session.userDocuments[i].id == documentId) {
                return session.userDocuments[i];
            }
        }
    }
    return null;
};

/**
 * createNewDocument
 * create a new document for the current user
 *
 * @param docName -> document name
 * @param currentUser -> created by
 * @return DocPrivilege -> representing new document
 */
var createNewDocument = function(docName, currentUser) {
    // create the document (with some properties)
    var newDoc = new Document();
    var newDocObj = {
        name: docName,
        data: "",
        lastModified: new Date(),
        usersWithShareAccess: [currentUser],
        documentType: 0 // latex document
    };

    for (var key in newDocObj) {
        newDoc[key] = newDocObj[key];
    }
    // save the document
    newDoc.save();

    return newDoc;
};


/**
 * giveUserSharePower
 *
 * if user has full access to doc, give user power to be able to 
 * share the document with other users
 *
 * @param fromUser -> user to give full access to
 * @param documentId -> document id of document concerned
 */
var giveUserSharePower = function(fromUser, documentId) {
    Document.findOne({
        _id: documentId
    }, function(err, doc) {
        if (!err) {
            if (doc.usersWithShareAccess.indexOf(fromUser) == -1) {
                doc.usersWithShareAccess.push(fromUser);

                // save doc
                doc.save();
            }
        }
        else {
            console.log("An error occured while trying to note " + "in document model that " + fromUser + " has full access to the doc");
        }
    });
};


exports.cloneObject = cloneObject;
exports.loadUser = loadUser;
exports.displayErrorsForSignUp = displayErrorsForSignUp;
exports.searchForDocsInSession = searchForDocsInSession;
exports.createNewDocument = createNewDocument;
exports.giveUserSharePower = giveUserSharePower;
exports.getPrivileges = getPrivileges;
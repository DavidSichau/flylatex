/**
 * helpers.js ->
 *  Contains helper functions
 *  that don't take in (req, res)
 */

var mongoose = require("mongoose");
// import 'needed' models here
var Document = mongoose.model("Document");
var DocPrivilege = mongoose.model("DocPrivilege");
var Project = mongoose.model("Project");
var PDFDoc = mongoose.model("PDFDoc");

var configs = require("../configs");
var exec = require("child_process").exec
, fs = require("fs-extra")
, util = require("util")
, path = require("path");

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
    loadDocuments(user.documentsPriv, function(err, userDocuments){
        obj.userDocuments = userDocuments;
        callback(false, obj);
    });
};

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
                
                Project.findOne({
                    _id: docPriv. projectId
                }, function(err, project) {
                    if (err || ! project) {
                        console.log("error: cannot find project ");
                        console.log(err);
                        return;
                    }
                    var userDocument = {}
                    var userDoc = loadProject(project, docPriv.access);
                    for (var key in userDoc) {
                        userDocument[key] = userDoc[key];
                    }
                    userDocuments.push(userDocument);
                    // make sure that all documents are loaded
                    if (++processed == count) {
                        callback(false , userDocuments);
                    }
                
                });
            }

        });
    });
    
}



/*
 * Helper function to load on single document from the docPriv
 */
var loadProject= function(project, access) {
    var userDocument = {};
    // var priv;
    userDocument.id = project._id;
    userDocument.masterId = project.masterId;
    userDocument.name = project.name;
    userDocument.access = access;
    userDocument.subDocs = [];
    for (var i = 0; i< project.subDocs.length; i++) {
        userDocument.subDocs.push(project.subDocs[i]);    
    }
    
    
    var priv = getPrivileges(access);
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




/**
 * searchForDocsInSession
 * search for document in session.userDocuments
 *
 * @param documentId - id of document to search for
 * @param session - session object for current user
 * @return document
 */
var searchForDocsInSession = function(documentId, session) {
    if (session.userDocuments !== undefined) {
        for (var i = 0; i < session.userDocuments.length; i++) {
            if (session.userDocuments[i].masterId == documentId) {
                return session.userDocuments[i];
            }
            if (session.userDocuments[i].subDocs !== undefined) {
               for (var j = 0; j < session.userDocuments[i].subDocs.length; j++) {
                    if (session.userDocuments[i].subDocs[j].id == documentId) {
                        return session.userDocuments[i];
                    }   
               }
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
var createNewDocument = function(docName) {
    // create the document (with some properties)
    var newDoc = new Document();
    var newDocObj = {
        name: docName,
        data: "",
        lastModified: new Date(),
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
 * createNewProject
 * creates a new project
 * 
 * @param document -> the master document
 * @return Project-> The new Project
 */
var createNewProject = function(document, username) {
    var newProject = new Project();
    newProject.name = document.name;
    newProject.masterId = document._id;
    newProject.subDocs = [];
    newProject.usersWithShareAccess = [username]; 
    newProject.save();
    return newProject;
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
var giveUserSharePower = function(fromUser, projectId) {
    Project.findOne({
        _id: projectId
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


var compilePdf = function(dirPath, response, res, masterName, projectId) {

    console.log(dirPath);

    var masterPath = path.join(dirPath, masterName + ".tex");


    process.chdir(dirPath);

    // copy files from the packages folder
    // to the temp directory for compiling
    console.log("From: " + configs.includes.path + "*");
    console.log("To: " + dirPath + "/");
    exec("cp -r " + configs.includes.path + "*  " + dirPath + "/", function(err) {
        if (err) {
            response.errors.push("Error copying additional packages to use in compilation");
            return;
        }
        // compile the document (or at least try)
        // redirect the stdin, stderr results of compilation
        // since the results of compilation will eventually be
        // written to the log file
        exec("pdflatex -interaction=nonstopmode " + masterPath + " > /dev/null 2>&1", function(err) {
            // store the logs for the user here
            fs.readFile(path.join(dirPath, masterName + ".log"), function(err, data) {
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
                newpdf.forDocument = projectId;
                newpdf.title = masterName + ".pdf";
                var tempfile = path.join(dirPath, newpdf.title);
                fs.copy(tempfile, configs.pdfs.path + newpdf.title, function(err) {
                    if (err) {
                        console.log(err);
                        response.errors.push(errorStr);
                        res.json(response);
                        return;
                    }
                    else {
                        console.log("Successfully saved " + newpdf.title + " in " + configs.pdfs.path);
                        newpdf.save(function(err) {
                            if (err) {
                                console.log(err);
                                response.errors.push(errorStr);
                                res.json(response);
                                return;
                            }
                            response.infos.push("Successfully compiled " + masterName);
                            // make the compiledDocURI
                            response.compiledDocURI = "/servepdf/" + projectId;
                            // send response back to user
                            res.json(response);
                        });
                    }
                });
            });
        });

    });
};

exports.compilePdf = compilePdf;
exports.cloneObject = cloneObject;
exports.loadUser = loadUser;
exports.loadProject = loadProject;
exports.searchForDocsInSession = searchForDocsInSession;
exports.createNewDocument = createNewDocument;
exports.createNewProject= createNewProject;
exports.giveUserSharePower = giveUserSharePower;
exports.getPrivileges = getPrivileges;
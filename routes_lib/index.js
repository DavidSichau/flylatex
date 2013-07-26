/*
 * index
 * handles both get and post request on the / page
 * @param req -> request object
 * @param res -> response object
 * @param err -> error object
 *
 */
exports.index = function(req, res, err) {
    req.session.currentUser = (req.session.currentUser == undefined ? "" : req.session.currentUser);

    req.session.isLoggedIn = (req.session.isLoggedIn == undefined ? false : req.session.isLoggedIn);

    req.session.userDocuments = (req.session.userDocuments == undefined ? [] : req.session.userDocuments);
    
    // delete the session such that after an reload the messages are deleted
    var errorMessage = req.session.errorMessage;
    delete req.session.errorMessage;
    var infoMessage = req.session.infoMessage;
    delete req.session.infoMessage;
    
    if (req.session.currentUser && req.session.isLoggedIn) {
        // display the documents for user
        res.render("display-docs", {
            title: "Fly Latex: Start Editing Documents",
            shortTitle: "Fly Latex",
            tagLine: "Start Editing Documents with Your Peers!",
            fileSpecificScript: "application.js",
            currentUser: req.session.currentUser,
            isLoggedIn: req.session.isLoggedIn,
            userDocuments: req.session.userDocuments,
            info: infoMessage,
            error: errorMessage
        });

    }
    else {
        // user didn't try to log in 
        res.render("not-logged-in", {
            title: "Log Into/Sign Into to FLY LATEX!",
            shortTitle: "FLY LATEX",
            tagLine: "Real Time Collaborative editor in node-js",
            fileSpecificStyle: "not-logged-in.css",
            info: infoMessage,
            error: errorMessage
        });
    }
};

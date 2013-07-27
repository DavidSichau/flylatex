/*
 * logOutUser -
 * log user out
 * @param req -> request object
 * @param res -> response object
 * @param next -> next (middleware) function (in callchain) to execute
 */
var logOutUser = function(req, res, next) {
    if (req.session.currentUser && req.session.isLoggedIn) {
        req.session.regenerate(function(err) {
            if (err) {
                console.log("==========Error while logging out=============");
            }
            next();
        });
    }
};

module.exports = logOutUser;
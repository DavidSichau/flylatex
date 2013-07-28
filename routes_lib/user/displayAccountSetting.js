/*
 * displayAccountSettings ->
 *  displays form for changing the account settings
 *  fly latex
 * @param req -> request object
 * @param res -> response object
 */
var displayAccountSettings= function(req, res) {
    res.render("account-settings", {
        title: "Change you account information for Fly Latex",
        shortTitle: "Account Settings",
        tagLine: "of " + req.session.currentUser,
        currentUser: req.session.currentUser,
        isLoggedIn: req.session.isLoggedIn,
        userDocuments: req.session.userDocuments,
        fileSpecificStyle: "sign-up.css",
        fileSpecificScript: "application.js"
    });
};

module.exports = displayAccountSettings;

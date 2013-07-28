
var configs = require("../../configs")
var mongoose = require("mongoose").connect(configs.db.url);
var User = mongoose.model("User");


/**
 * processSignUpData ->
 *  processes the sign up data posted from the sign
 *  up form and logs the user into fly latex
 *  , redirecting him to his home page.
 * @param req -> request object
 * @param res -> response object
 */
var processAccountSetting = function(req, res) {
    var errors = {}; // key-value pair -> error Type : error Message
    var isError = false;
    var user = req.body.user;
    console.log(user);
    
    if (typeof(user.password) !== 'undefined') {

        // make sure valid password
        if (!(user.password.length > 4 // password has to be at least 5 chars 
        &&
        /\d+/.test(user.password))) { // password has to have at least one digit
            errors["passwordInvalid"] = "Password must be at least 5 chars and must contain at least one digit";
            isError = true;
        }

        // make sure password == confirmPassword
        if (user.password != user.confirmPassword) {
            errors["passwordNoMatch"] = "The Confirm Password should match the initial password entry";
            isError = true;
        }
    } else if(typeof(user.email) !== 'undefined') {

        // make sure email is valid
        if (!(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(user.email))) {
            errors["emailInvalid"] = "Enter a valid email address";
            isError = true;
        }
    }

    if (!isError) {
        // there's no error. Save the new user
        // only if someone else doesn't have his username
        User.findOne({
            userName: req.session.currentUser
        }, function(err, dbUser) {
            if (typeof(user.password) !== 'undefined') {
                if (!dbUser.authenticate(user.oldPassword)) {
                    // user's password incorrect
                    errors["wrongPassword"] = "The old password was incorrect";
                    displayErrorsForAccountSettings(req, res,errors);
                } else {
                    // change the pw
                    dbUser.password = user.password;
                    dbUser.save(function(err) {
                        if (err) {
                            console.log("==============Error in saving changed user======");
                        }
                        else {
                            console.log("================changed user=============");
                        }
                        console.log(dbUser);
                        console.log("======================================");
                    });
                    res.redirect("/");
                }
            } else if(typeof(user.email) !== 'undefined') {
                dbUser.email = user.email;
                dbUser.save(function(err) {
                    if (err) {
                        console.log("==============Error in saving changed user======");
                    }
                    else {
                        console.log("================changed user=============");
                    }
                    console.log(dbUser);
                    console.log("======================================");
                });
                res.redirect("/");
            }
        });
    } else {
	// there's an error. Return error message(s) to user
        displayErrorsForAccountSettings(req, res, errors);
    }
};

module.exports = processAccountSetting;

/*
 * Helper function
 * displayErrorsForSignUp
*/
var displayErrorsForAccountSettings = function(req, res, errors) {
    
    res.render("account-settings", {
        title: "Change you account information for Fly Latex",
        shortTitle: "Account Settings",
        tagLine: "of " + req.session.currentUser,
        currentUser: req.session.currentUser,
        isLoggedIn: req.session.isLoggedIn,
        userDocuments: req.session.userDocuments,
        fileSpecificStyle: "sign-up.css",
        fileSpecificScript: "application.js",
        errors : errors
    });
};
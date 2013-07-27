// load helpers here
var helpers = require("../helpers.js");


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
                    res.redirect("/");
                });

            }
        });
    } else {
	// there's an error. Return error message(s) to user
	helpers.displayErrorsForSignUp(res, errors);
    }
};

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
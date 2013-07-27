// load helpers here
var helpers = require("../helpers.js");


var configs = require("../../configs")
var mongoose = require("mongoose").connect(configs.db.url);
var User = mongoose.model("User");




var login =  function(req, res) {
    console.log("login called");
    if (req.body.username && req.body.username.length > 0 && req.body.password && req.body.password.length > 0) {

        // user's not logged in, but wants to log in
        User.findOne({
            userName: req.body.username
        }, function(err, user) {
            if (err) {
                console.log("error: ");
                console.log(err);
                req.session.currentUser = null;
                req.session.isLoggedIn = false;
                req.redirect('back');
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
                    res.redirect('/');
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



module.exports = login;
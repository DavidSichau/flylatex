var config = {
    pdfs: {
        // absolute path of where to store compiled pdfs
        // defaults to "pdfs" directory in "flylatex" repo
        path: ""
    },
    db: {
        db: 'flylatex', // the name of the database
        host: 'blub.com', // the ip adress of the database
        port: 10091, // the port of the mongo db
        username: 'user', //the username if not needed use undefined
        password: 'pw', // the password for the db access if not needed use undefined
        get url() { // generates the mongo db url
            var dataUrl = "mongodb://";
            if (config.db.username !== undefined) {
                dataUrl += config.db.username + ':' + config.db.password + '@';
            }
            dataUrl += config.db.host + ":" + config.db.port;
            dataUrl += '/' + config.db.db;
            return dataUrl;
        }
    },
    docs: {
        // maximum number of documents per user
        MAX_NUM_PER_USER: 20
    },
    includes: {
        // absolute path of includes
        // defaults to "texpackages" directory in "flylatex" repo
        path: ""
    }
};


// export the configurations
module.exports = config;

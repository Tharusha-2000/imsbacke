const jwt = require('jsonwebtoken');

const ENV = require('../config.js');


/** auth middleware */
 async function Auth(req, res, next){
    try {
        
        // access authorize header to validate request
        const token = req.headers.authorization.split(" ")[1];
       
        // retrive the user details fo the logged in user
        const decodedToken = await jwt.verify(token, ENV.JWT_SECRET);

        req.user = decodedToken;
        console.log("decodedToken");
        console.log(decodedToken);    
        //res.json(decodedToken);

        next()

    } catch (error) {
        res.status(401).json({ error : "Authentication Failed!"})
    }


} 


function localVariables(req, res, next){
    req.app.locals = {
        OTP : null,
        resetSession : false
    }
    next();
}

module.exports ={Auth, localVariables};



const express = require("express");
const router = express.Router();
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ENV= require('../config.js');
const middleware = require('../middleware/auth.js');
const Auth = middleware.Auth;
const localVariables = middleware.localVariables;
const otpGenerator = require('otp-generator');
var nodemailer = require('nodemailer');

/*..............................login page.............................................*/
/* POST: http://localhost:8000/api/users/login */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const user = await User.findOne({ email });

     if (!user) {
      return res.status(401).json({ loginStatus: false, msg: "Incorrect email" });
     }
   
     const isPasswordValid = await bcrypt.compare(password,user.password);
     if(!isPasswordValid) {
      return res.status(401).json({ loginStatus: false, msg: "Incorrect password" });
     }
   
    const token = jwt.sign(
      {  email: user.email,id: user._id,role: user.role },ENV.JWT_SECRET,
      { expiresIn: "3d" }
    );
    
    //res.cookie('token', token);
    
    res.status(200).send({
      msg: "Login Successful...!",
      username: user.username,
      role: user.role,
      token
  });   

  } catch (error) {
    console.error(error);
    res.status(500).json({ loginStatus: false, Error: "Internal Server Error" });
  }
});

/** POST: http://localhost:8000/api/users/generateOTP */
router.post("/generateOTP&sendmail",localVariables,async (req,res)=>{
   
  try{
     const { email } = req.body;
     const existingUser = await User.findOne({ email });
  
     if(!existingUser){
            return res.json({ msg: "User not registered" });
      }
     else{
     const otp = await otpGenerator.generate(6, { lowerCaseAlphabets: false,
                                                  upperCaseAlphabets: false,
                                                  specialChars: false})
                                         
  
   // Store OTP in req.app.locals for later verification if needed
       req.app.locals.OTP = otp;

       var transporter = nodemailer.createTransport({
          service: 'gmail',
          port: 534,
           auth: {
             user: 'IMSystem99x@gmail.com',
             pass: 'jqlwlkuvbtrmofmj'
           }
         });
       
       var mailOptions = {
          from: 'IMSystem99x@gmail.com',
          to: email,
          subject: 'Sending Email using Node.js',
          html:`
          <div style="width: 500px; padding: 20px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; font-family: Arial, sans-serif; background-color: #f9f9f9;">
                   <h1 style="color: blue; text-align: center;">Your OTP</h1>
                   <p style="text-align: center; color: #333; font-size: 20px;">${otp}</p>
          </div>
          `
     
       };

    transporter.sendMail(mailOptions, function(error, info){
       if (error) {
         console.log(error);
       } else {
         console.log('Email sent: ' + info.response);
       }
      });
       res.status(201).send({ msg: "otp send!",code: otp})
      
     }
  }catch(error){ 
        console.error(error);
        res.status(500).send({ error: "Internal Server Error" });
    }

});

/** GET: http://localhost:8000/api/users/verifyOTP */
router.get("/verifyOTP",async (req,res)=>{

         const { code } = req.query;

         const otpTimeout= setTimeout(() => {
           req.app.locals.OTP = null;
          },  1 * 60 * 1000);



        if(parseInt(req.app.locals.OTP) === parseInt(code)){
          clearTimeout(otpTimeout);
          req.app.locals.OTP = null; // reset the OTP value
          req.app.locals.resetSession = true; // start session for reset password
          return res.status(201).send({ msg: 'Verify Successsfully!'})
        }
        return res.status(400).send({ msg: "Invalid OTP"});
        });

// successfully redirect user when OTP is valid
/** GET: http://localhost:8000/api/users/createResetSession */
const createResetSession = (req,res)=>{
      if(req.app.locals.resetSession){
          return res.status(201).send({ flag : req.app.locals.resetSession})
      }
      return res.status(440).send({msg : "Session expired!"})
      }

router.put("/resetPassword" ,async (req,res)=>{
      try {
        
        if(!req.app.locals.resetSession) return res.status(440).send({msg : "Session expired!"});

           const { email, password } = req.body;

        try {
            const user=await User.findOne({email});
            if(!user){
                return res.json({ message: "User not registered" });
            }
            const hashedPassword = await bcrypt.hash(password, 12);
                  await User.updateOne(
                        {
                          email: email,
                        },
                        {
                        $set: {
                          password: hashedPassword,
                        },
                        }
                      
                  );
                  req.app.locals.resetSession = false; // reset session
                  return res.status(201).send({ msg : "Record Updated...!"})    

          } catch (error) {
            return res.status(500).send({ error })
             }

       } catch (error) {
        return res.status(401).send({ error: "Invalid Request"})
        }
    });




/*.............................registation add user table............................*/
 
router.get('/user', async (req, res) => {
  try {
      // Fetch all users from the database
      const users = await User.find();
       const data=
              res
              .status(201)
              .json({  success: true, users });
             
  }catch(error){
      console.error(error);
      res.status(500).send('Internal Server Error');
  }

});


router.delete('/user/:id',async(req, res)=> {
  try{
      let id = req.params.id;
      const user= await User.findByIdAndDelete(id);
          res.status(200).send( {msg: "User deleted"});

      }catch(error){
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
  
});

router.put('/user/:id', async (req, res) => {
     const { role } = req.body;
     const { id } = req.params;

    
  try {
        const user = await User.findById(id);
         if (!user) {
            return res.status(404).send('User not found');
          }

        await User.updateOne(
          {
              _id:id,
          },
          {
             $set: {
               role: role,
           },
          }
        );
      return res.status(201).send({ msg : "Record Updated...!"}) 

    }  catch (err) {
       console.error(err);
       res.status(500).send('Server error');
      }
});

router.post("/register",async (req, res, next) => {
  
  try {
    const { fname,lname,dob,role,gender,email,password} = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ msg: "User already exists" });
       }
    const user = await User.create({ fname,lname,dob,role,gender,email,password });
     const data=
      res
        .status(201)
        .json({ msg: "User signed in successfully", success: true, user });

      var transporter = nodemailer.createTransport({

        service: 'gmail',
        port: 534,
        auth: {
          user: 'IMSystem99x@gmail.com',
          pass: 'jqlwlkuvbtrmofmj'
        }
      });
      
      var mailOptions = {
        from: 'IMSystem99x@gmail.com',
        to: email,
        subject: 'Sending Email using Node.js',
        html:  `
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; font-family: Arial, sans-serif;">
              <h1 style="color: blue; text-align: center;">Welcome to IMS</h1>
              <p style="text-align: center; color: #333;">You have successfully registered to the IMS. Here are your details:</p>
              <div style="background-color: #fff; padding: 10px; border-radius: 10px; margin: 20px 0; color: #333;">
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong> ${password}</p>
              </div>
              <p style="text-align: center; color: #333;">Your are welcome!</p>
            </div> `


      };
      
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
      
    next();
  } catch (error) {
    console.error(error);
  }

});

 

 





/** PUT: http://localhost:8000/api/updateuser 
* @param: {
"header" : "<token>"
}
body: {
  firstName: '',
  address : '',
  profile : ''
}
*/
router.put('/updateuser',Auth, async (req, res) => {
  //const id = req.query.id;
  const { id } = req.user;
  try {
    
    if (!id) {
      return res.status(401).send({ error: "User ID not provided" });
    }

    const body = req.body;

    // Update the data
    const result = await User.updateOne({ _id: id}, body);

    if (result.nModified === 0) {
      return res.status(404).send({ error: "User not found or no changes applied" });
    }

    return res.status(200).send({ msg: "Record Updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: "Internal Server Error" });
  }
});

/* GET: http://localhost:8000/api/users/user/dinu */
router.get("/user/:username", async (req, res) => {
        const { username } = req.params;
  try {
      if (!username) return res.status(501).send({ error: "Invalid Username" });
        const user = await User.findOne({ username });

      if (!user) return res.status(501).send({ error: "Couldn't Find the User" });
      //romove hash password
        const {password,...rest} = Object.assign({}, user.toJSON());
        return res.status(201).send(rest);

      }catch(error){
          return res.status(404).send({ error: "Cannot Find User Data" });
      }
      });



/*......................................hansi.......................*/

router.put('/secure',Auth, async (req, res) => {
  try {
    const { id } = req.user;
    const { OldPassword, NewPassword } = req.body;
    
    const user = await User.findById(id);
    console.log(id, user, OldPassword, NewPassword);
    const validPassword = await bcrypt.compare(OldPassword, user.password);
    if (!validPassword) {
      return res.status(400).send({msg:'Invalid old password.'});
    
    }
    const hashedPassword = await bcrypt.hash(NewPassword, 12);
    user.password = hashedPassword;

    await User.updateOne(
          {
            _id:id,
          },
          {
           $set: {
            password: hashedPassword,
           },
          }
        
    );
   
    return res.status(201).send({ msg : "Record Updated...!"})   
    
  } catch (error) {
    console.error(error);
    res.status(500).send({msg:"Internal Server Error"});
  }
});

/*......................................hansi.......................*/

module.exports = router;


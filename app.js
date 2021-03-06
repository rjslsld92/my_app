// import modules
var express = require('express');
var app = express();
var path = require('path');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

/* import modules (계정관리) */
var passport = require('passport');
var session = require('express-session');
var flash = require('connect-flash');
var async = require('async');

// connect database
/* useFindAndModify: false -> delete 했을때 생기는 에러로그 안뜨게 하기 위한 옵션 */
mongoose.connect(process.env.MONGO_DB, { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false ,useCreateIndex: true});
var db = mongoose.connection;
db.once("open", function () {
    console.log("DB connected!");
});
db.on("error", function (err) {
    console.log("DB ERROR :", err);
});

// model setting
var postSchema = mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    author: {type:mongoose.Schema.Types.ObjectId, ref:'user', required:true},
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
});
var Post = mongoose.model('post', postSchema);

/* password hash 암호화 (문자는 hash 로 변환 가능하지만 hash는 문자로 변환 불가능.) */
var bcrypt = require('bcrypt-nodejs');

var userSchema = mongoose.Schema({
    email: { type: String, required: true, unique: true },
    nickname: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: String, default: Date.now }
});

userSchema.pre("save", function(next){
    var user = this;
    if(!user.isModified("password")){
        return next();
    }else{
        user.password = bcrypt.hashSync(user.password);
        return next();
    }
});


/* db에 hash로 저장되므로 == 가 아닌 authenticate 로 password 비교 해야함. */
userSchema.methods.authenticate = function(password){
    var user = this;
    return bcrypt.compareSync(password,user.password);
};

userSchema.methods.hash = function(password){
    return bcrypt.hashSync(password);
};

var User = mongoose.model('user', userSchema);

// view setting
app.set("view engine", 'ejs');

// set middlewares
app.use(express.static(path.join(__dirname, 'public')));
/* 다른 프로그램이 JSON으로 데이터 전송을 할 경우 받는 body parser */
app.use(bodyParser.json());
/* 웹사이트가 JSON으로 데이터 전송 할 경우 받는 body parser */
app.use(bodyParser.urlencoded({ extended: true }));
/* post를 제외한 나머지 신호 차단. 우회하기 위한 package */
app.use(methodOverride("_method"));
/* 계정관리를 위한 packahge */
app.use(flash());

app.use(session({ secret: "MyScret" }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

var localStrategy = require('passport-local').Strategy;
passport.use('local-login',
    new localStrategy({
        usernameField: 'email',
        passworField: 'password',
        passReqToCallback: true
    },
        function (req, email, password, done) {
            User.findOne({ 'email': email }, function (err, user) {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    req.flash("email", req.body.email);
                    return done(null, false, req.flash('loginError', 'No user found.'));
                }
                if (!user.authenticate(password)) {
                    req.flash("email", req.body, email);
                    return done(null, false, req.flash('loginError', 'Password does not Match.'));
                }

                return done(null, user);
            });
        })
);

// set home routes
app.get('/', function (req, res) {
    res.redirect('/posts');
});

app.get('/login', function (req, res) {
    res.render('login/login', { email: req.flash("email")[0], loginError: req.flash('loginError') });
});

app.post('/login',
    function (req, res, next) {
        req.flash("email"); // flush email data
        if (req.body.email.length === 0 || req.body.password.length === 0) {
            req.flash("email", req.body.email);
            req.flash("loginError", "Please enter both email and password.");
            res.redirect('/login');
        } else {
            next();
        }
    }, passport.authenticate('local-login', {
        successRedirect: '/posts',
        failureRedirect: '/login',
        failureFlash: true
    })
);

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

// set routes
app.get('/posts', function (req, res) {
    /* 
    find 에서 바로 callback 하지않고, find 로 찾은 후
    sort 로 정렬. (-createdAt 이므로 createdAt 역방향 정렬)
    그 다음 exec 으로 함수를 수정.    
    */
    Post.find({}).populate("author").sort('-createdAt').exec(function (err, posts) {
        if (err) {
            return res.json({ success: false, message: err });
        }
        res.render("posts/index", { posts:posts, user:req.user });
    });
}); // index

app.get('/posts/new', isLoggedIn, function (req, res) {
    res.render("posts/new", {user : req.user});
}); // new

app.post('/posts', isLoggedIn, function (req, res) {
    req.body.post.author = req.user._id;

    Post.create(req.body.post,function (err,post) {
        if (err) {
            console.log('test');
            return res.json({ success: false, message: err });
        }
        res.redirect('/posts');
    });
}); // create

app.get('/posts/:id', function (req, res) {
    Post.findById(req.params.id).populate("author").exec(function(err, post){
        if (err) {
            return res.json({ success: false, message: err });
        }
        res.render("posts/show", { post: post , user: req.user});
    });
}); // show

app.get('/posts/:id/edit', isLoggedIn, function (req, res) {
    Post.findById(req.params.id, function (err, post) {
        if (err) {
            return res.json({ success: false, message: err });
        }
        if(!req.user._id.equals(post.user)){
            return res.json({ success: false, message: "Unauthorized Attempt" });
        }
        res.render("posts/edit", { post: post, user: req.user });
    });
}); // edit

app.put('/posts/:id', isLoggedIn, function (req, res) {
    req.body.post.updatedAt = Date.now();
    Post.findByIdAndUpdate({_is:req.params.id, author: req.user._id}, req.body.post, function (err, post) {
        if (err) {
            return res.json({ success: false, message: err });
        }
        if(!post){
            return res.json({ success: false, message: "No data found to update" });
        }
        res.redirect('/posts/' + req.params.id);
    });
}); //update

app.delete('/posts/:id', isLoggedIn, function (req, res) {
    Post.findByIdAndRemove({_is:req.params.id, author: req.user._id}, function (err, post) {
        if (err) {
            return res.json({ success: false, message: err });
        }
        if(!post){
            return res.json({ success: false, message: "No data found to delete" });
        }
        res.redirect('/posts');
    });
}); //destroy

/* 계정관리를 위한 CRUD */
app.get('/users/new', function (req, res) {
    res.render('users/new', {
        formData: req.flash('formData')[0],
        emailError: req.flash('emailError')[0],
        nicknameError: req.flash('nicknameError')[0],
        passwordError: req.flash('passwordError')[0]
    });
}); //new

app.post('/users', checkUserRegValidation, function (req, res, next) {
    User.create(req.body.user, function (err, user) {
        if (err) {
            return res.json({ success: false, message: err });
        }
        res.redirect('/login');
    });
}); //create
app.get('/users/:id', isLoggedIn, function (req, res) {
    User.findById(req.params.id, function (err, user) {
        if (err) return res.json({ success: false, message: err });
        res.render("users/show", { user: user });
    });
}); // show

app.get('/users/:id/edit', isLoggedIn, function (req, res) {
    User.findById(req.params.id, function (err, user) {
        if (err) {
            return res.json({ success: false, message: err });
        }
        res.render("users/edit", {
            user: user,
            formData: req.flash('formData')[0],
            emailError: req.flash('emailError')[0],
            nicknameError: req.flash('nicknameError')[0],
            passwordError: req.flash('passwordError')[0]
        });
    });
}); //edit

app.delete('/users/:id', function (req, res) {
    User.findByIdAndRemove(req.params.id, function (err, post) {
        if (err) {
            return res.json({ success: false, message: err });
        }
        res.redirect('/logout');
    });
}); //destroy

app.put('/users/:id', isLoggedIn, checkUserRegValidation, function (req, res) {
    User.findById(req.params.id, req.body.user, function (err, user) {
        if (err) {
            return res.json({ success: false, message: err });
        }
        if (user.authenticate(req.body.user.password)) {
            if (req.body.user.newPassword) {
                req.body.user.password = user.hash(req.body.user.newPassword);
            } else {
                delete req.body.user.password;
            }
            User.findByIdAndUpdate(req.params.id, req.body.user, function (err, user) {
                if (err) {
                    return res.json({ success: false, message: err });
                }
                res.redirect('/users/' + req.params.id);
            });
        } else {
            req.flash("formData", req.body.user);
            req.flash("passwordError", "- Invalid password");
            req.redirect('/users/' + req.params.id + "/edit");
        }

    });
}); //update

// function
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect('/');
}

function checkUserRegValidation(req, res, next) {
    var isValid = true;

    async.waterfall(
        [function (callback) {
            User.findOne({ email: req.body.user.email, _id: { $ne: mongoose.Types.ObjectId(req.params.id) } },
                function (err, user) {
                    if (user) {
                        isValid = false;
                        req.flash("emailError", "- This email is already resistered.");
                    }
                    callback(null, isValid);
                }
            );
        }, function (isValid, callback) {
            User.findOne({ nickname: req.body.user.nickname, _id: { $ne: mongoose.Types.ObjectId(req.params.id) } },
                function (err, user) {
                    if (user) {
                        isValid = false;
                        req.flash("nicknameError", "- This nickname is already resistered.");
                    }
                    callback(null, isValid);
                }
            );
        }], function (err, isValid) {
            if (err) return res.json({ success: "false", message: err });
            if (isValid) {
                return next();
            } else {
                req.flash("formData", req.body.user);
                res.redirect("back");
            }
        }
    );
}

// start server
app.listen(3000, function () {
    console.log('Server On!');
});
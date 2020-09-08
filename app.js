var express = require('express');

const { dirname } = require('path');
const path = require('path');
var app = express();

var mongoose = require('mongoose');
/* 
mongoose.connect("mongodb+srv://test_user:test_user@mongolgh.qvo0f.mongodb.net/test?retryWrites=true&w=majority");
 */
/* 환경변수에 등록 한 후 사용 */
mongoose.connect(process.env.MONGO_DB);
const db = mongoose.connection;

// mongoDB 연동 실패 시 에러 메시지 출력
db.on('error', function(err){
    console.log("DB ERROR",err);
});  

// mongoDB 연동 성공 시 메시지 출력
db.once('open', function(){
  console.log('mongoDB CONNECTED');
});

/* mongoDB schema 생성 */
var dataSchema = mongoose.Schema({
    name : String,
    count : Number
});

/* mongoDB model 생성 */
var Data = mongoose.model('data', dataSchema);
Data.findOne({name : "myData"} , function(err, data){
    if(err){
        return console.log("Data ERROR : ",err);
    }
    if(!data){
        Data.create({name : "myData", count : 0}, function(err, data){
            if(err){
                return console.log("Data ERROR", err);
            }
            console.log("Counter initialized : ", data);
        });
    }
});



/* 
app.get('/', function(req,res){
    res.send('HELLO WORLD');
});
 */

/* path.join 을 이용해서 경로 붙일 수 있음.
app.use(express.static(__dirname + '/public'));
 */

app.set("view engine", 'ejs');
app.use(express.static(path.join(__dirname,'public')));

var data = {count : 0};

app.get('/', function(req,res){
    Data.findOne({name : "myData"}, function(err, data){
        if(err){
            return console.log("Data ERROR : ", err);
        }
        data.count++;
        data.save(function(err){
            if(err){
                return console.log("Data ERROR : ", err);
            }
            res.render('my_first_ejs', data);
        });
    });
});

app.get('/reset', function(req,res){
    setCounter(res, 0);
});

app.get('/set/count', function(req,res){
    if(req.query.count){
        setCounter(res, req.query.count);
    }else{
        getCounter(res);
    }
});

app.get('/set/:num', function(req,res){
    if(req.params.num){
        setCounter(res, req.params.num);
    }else{
        getCounter(res);
    }
});

function setCounter(res, num){
    console.log("setCounter");
    Data.findOne({name : "myData"}, function(err, data){
        if(err){
            return console.log("Data ERROR : ", err);
        }
        data.count = num;
        data.save(function(err){
            if(err){
                return console.log("Data ERROR : ", err);
            }
            res.render('my_first_ejs', data);
        });
    });
}

function getCounter(res){
    console.log("getCounter");
    Data.findOne({name : "myData"}, function(err, data){
        if(err){
            return console.log("Data ERROR : ", err);
        }
        res.render('my_first_ejs', data);
    });
}

/* 디렉토리 경로 
console.log(__dirname);
console.log(path.join(__dirname , 'public'));
 */
app.listen(3000, function(){
    console.log('SERVER ON2');
});
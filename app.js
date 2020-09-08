var express = require('express');

const { dirname } = require('path');
const path = require('path');
const { allowedNodeEnvironmentFlags } = require('process');

var app = express();

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
    data.count++;
    res.render('my_first_ejs',data);
});

app.get('/reset', function(req,res){
    data.count = 0;
    res.render('my_first_ejs',data);
});

app.get('/set/count', function(req,res){
    if(req.query.count){
        data.count = req.query.count;
    }
    res.render('my_first_ejs',data);
});

app.get('/set/:num', function(req,res){
    data.count = req.params.num;
    res.render('my_first_ejs',data);
});

/* 디렉토리 경로 
console.log(__dirname);
console.log(path.join(__dirname , 'public'));
 */
app.listen(3000, function(){
    console.log('SERVER ON');
});
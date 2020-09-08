var express = require('express');

const { dirname } = require('path');
const path = require('path');

var app = express();

/* 
app.get('/', function(req,res){
    res.send('HELLO WORLD');
});
 */

/* 
app.use(express.static(__dirname + '/public'));
 */

app.use(express.static(path.join(__dirname,'public')));

console.log(__dirname);
console.log(path.join(__dirname , 'public'));

app.listen(3000, function(){
    console.log('SERVER ON');
});
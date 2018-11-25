var bodyParser = require('body-parser');
var express = require('express');

var config = require("./config/live.js");
var app = express();

app.config = config

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

//Apis.instance(config.provider, true).init_promise.then((network) => {
	require('./app/routes/api')(app);

	app.listen(3000, function(){
		console.log(`Listening at http://localhost:3000`);
	});
/*}).catch((err) => {
	console.log('Network error!');
	console.log(err);
});*/
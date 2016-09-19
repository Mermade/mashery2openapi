var fs = require('fs');
var m2oa = require('./index.js');
var SwaggerParser = require('swagger-parser');

var options = {};
options.srcUrl = 'http://developer.rottentomatoes.com';

m2oa.convert('./test.html',options,function(err,openapi){
	for (var o in openapi) {
		var filename = 'swagger' + (o>0 ? o : '') + '.json';
		fs.writeFileSync(filename,JSON.stringify(openapi[o],null,2),'utf8');
		SwaggerParser.validate(openapi[o], function(vErr, api) {
			if (vErr) {
				console.log(filename);
				console.error(vErr);
				process.exitCode = 1;
			}
		});

	}
});
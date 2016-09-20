var fs = require('fs');
var m2oa = require('./index.js');
var SwaggerParser = require('swagger-parser');

function safeMkdir(dir){
	try {
		fs.mkdirSync(dir);
	}
	catch (ex) {}
	return dir;
}

var options = {};

var fileOrUrl = process.argv.length>2 ? process.argv[2] : './test.html';
if (fileOrUrl.indexOf('://')<0) {
	options.srcUrl = process.argv.length>3 ? process.argv[3] : 'http://developer.example.com';
}

m2oa.convertHtml(fileOrUrl,options,function(err,openapi){
	if (openapi.length<1) {
		process.exitCode = 2;
	}
	for (var o in openapi) {
		var api = openapi[o];
		var dir = './apis/'+api.host;

		safeMkdir(dir);
		dir += '/' + api.info.title.replace(' API','').split('*').join('').split('?').join('').trim().split(' ').join('-');
		safeMkdir(dir);
		dir += '/' + api.info.version.split(' ').join('-');
		safeMkdir(dir);

		try { fs.unlinkSync(dir+'/swagger.json'); } catch (ex) {}
		try { fs.unlinkSync(dir+'/swagger.err'); } catch (ex) {}

		SwaggerParser.validate(openapi[o], function(vErr, api) {
			if (vErr) {
				if (api) console.log('%s %s %s',api.host,api.info.title,api.info.version);
				console.error(vErr);
				process.exitCode = 1;
				extension = 'err';
			}
			else {
				extension = 'json';
			}
			fs.writeFileSync(dir+'/swagger.'+extension,JSON.stringify(openapi[o],null,2),'utf8');

		});

	}
});

process.on('exit',function(code){
	console.log('Exiting: %s',code);
	if (process.exitCode>0) {
		var log = 'Fail '+process.exitCode+' '+fileOrUrl+'\n';
		fs.appendFileSync('./mashery2openapi.log',log,'utf8');
	}
});
var fs = require('fs');
var m2oa = require('./index.js');
var SwaggerParser = require('swagger-parser');

var keep = {};
var valid = [];

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

console.log('in:  '+fileOrUrl);

m2oa.convertHtml(fileOrUrl,options,function(err,result){
	keep = result;
	if (result.collection.length<1) {
		process.exitCode = 2;
	}

	for (var o in result.collection) {
		valid.push(false);
		var api = result.collection[o];

		SwaggerParser.validate(api, function(vErr, api) {
			if (vErr) {
				console.error(vErr);
			}
			else {
				var masheryId = api.info["x-mashery-id"];
				var index = result.ids.indexOf(masheryId);
				if (index>=0) {
					valid[index] = true;
				}
				else {
					console.log('Could not find API by id: '+masheryId);
				}
			}
		});

	}
});

process.on('exit',function(code){
	for (var o in keep.collection) {

		var api = keep.collection[o];
		var dir = './apis/'+api.host;

		safeMkdir(dir);
		dir += '/' + api.info.title.replace(' API','').split('*').join('').split('?').join('').trim().split(' ').join('-');
		safeMkdir(dir);
		dir += '/' + api.info.version.split(' ').join('-');
		safeMkdir(dir);

		try { fs.unlinkSync(dir+'/swagger.json'); } catch (ex) {}
		try { fs.unlinkSync(dir+'/swagger.err'); } catch (ex) {}

		var extension = '';
		if (valid[o]) {
			extension = 'json';
		}
		else {
			//console.log('%s %s %s',api.host,api.info.title,api.info.version);
			process.exitCode = 1;
			extension = 'err';
		}
		console.log('out: '+dir+'/swagger.'+extension);
		fs.writeFileSync(dir+'/swagger.'+extension,JSON.stringify(api,null,2),'utf8');
	}

	if (process.exitCode>0) {
		var log = 'Fail '+process.exitCode+' '+fileOrUrl+'\n';
		fs.appendFileSync('./mashery2openapi.log',log,'utf8');
	}

	console.log('Exiting: %s',process.exitCode || code);
});

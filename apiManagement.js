/**
* module to process 'version 2' or API Management version specs from JSON source
*/

var url = require('url');
var fs = require('fs');
var request = require('request');

function retrieve(source,suffix,options) {
	request(source, function (error, response, body) {
		if (error) {
			console.log("Error requesting page: " + error);
			return false;
		}
		else {
			try {
				var obj = JSON.parse(body);
				if ((Object.keys(obj).length==2) && obj.status && obj.message) {
					// skip
				}
				else {
					console.log('Got a hit: %s',source);
					var outfile = './json/'+options.apiName+(suffix ? '-'+suffix : '')+'.json';
					console.log(outfile);
					fs.writeFile(outfile,JSON.stringify(obj,null,2),'utf8');
				}
			}
			catch (ex) {
			}
		}
	});
}

module.exports = {

	convertJSON : function($,options) {
		var x = {};
		x.url = options.urlOrFile;
		x.examples = x.url+'/examples';

		x.apiDesc = $('.apiDescription').first().text();
		x.extDocs = $('.full-docs').first().text();
		x.extUrl = $('.full-docs').first().attr('href');

		if (x.apiDesc || x.extDocs || x.extUrl) {
			console.log(x.apiDesc);
			console.log(x.extDocs+' '+x.extUrl);
		}

		fs.writeFile('./json/'+options.apiName+'-ext.json',JSON.stringify(x,null,2),'utf8');

		var u = url.parse(options.urlOrFile);

		var source = options.urlOrFile+'/data/'+options.apiName+'.json';
		retrieve(source,'',options);
		retrieve(options.urlOrFile+'/'+options.apiName+'.json',1,options);
		retrieve(options.urlOrFile+'/data/io-docs.json',2,options);
		retrieve(options.urlOrFile+'/data/iodocs.json',3,options);
		retrieve(options.urlOrFile+'/io-docs.json',4,options);
		retrieve(options.urlOrFile+'/iodocs.json',5,options);
		var root = u.protocol+'//'+u.host+'/data/'+options.apiName+'.json';
		if (root != source) retrieve(root,6,options);
	}

};
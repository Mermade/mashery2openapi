/**
* module to process 'version 2' or API Management version specs from JSON source
*/

var fs = require('fs');
var request = require('request');

module.exports = {

	convertJSON : function($,options) {
		var source = options.urlOrFile+'/data/'+options.apiName+'.json';
		console.log(source);

		var apiDesc = $('.apiDescription').first().text();
		console.log(apiDesc);

		var extDocs = $('.full-docs').first().text();
		var extUrl = $('.full-docs').first().attr('href');
		console.log(extDocs+' '+extUrl);

		request(source, function (error, response, body) {
			if (error) {
				console.log("Error requesting page: " + error);
				return false;
			}
			else {
				fs.writeFile('./json/'+options.apiName+'.json',body,'utf8');
			}
		});
	}

};
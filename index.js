/*
inurl:io-docs you can also view our written documentation

e.g. http://developer.ted.com/io-docs.html

*/

var fs = require('fs');
var up = require('url');
var request = require('request');
var cheerio = require('cheerio');
var _ = require('lodash');

var recurseotron = require('../openapi_optimise/common.js');

const externalDocsText = 'You can also view our written documentation.';
const noDescription = 'No description set';

function rename(obj,key,newKey){
	obj[newKey] = obj[key];
	delete obj[key];
}

function createSwagger(){
	var s = {};
	s.swagger = '2.0';
	s.info = {};
	s.info.title = '';
	s.info.version = '1.0.0';
	s.info.contact = {};
    s.info.contact.name = 'Mike Ralphson'
    s.info.contact.email = 'mike.ralphson@gmail.com';
    s.info.contact.url = 'https://github.com/mermade/mashery2openapi';
	s.info.license = {};
	s.info.license.name = 'MIT';
	s.info.license.url = 'https://opensource.org/licenses/MIT';
	s.schemes = [];
	s.schemes.push('http');
	s.host = 'example.com';
	s.basePath = '/';
	s.externalDocs = {};
	s.externalDocs.description = externalDocsText;
	s.externalDocs.url = '';
	s.consumes = [];
	s.produces = [];
	s.securityDefinitions = {};
	s.security = [];
	s.tags = [];
	s.paths = {};
	s.definitions = {};
	return s;
}

function optimisePaths(s){
	var minCommon = Number.MAX_VALUE;
	for (var p in s.paths) {
		var count = p.split('/').length-1;
		if (count<minCommon) minCommon = count;
	}
	if (minCommon>0) {
		var common = '';
		var components = [];
		for (var p in s.paths) {
			components = p.split('/');
			var path = '';
			for (var c=0;c<minCommon;c++) {
				if (components[c] && (components[c].indexOf('{')<0)) path += '/' + components[c];
			}
			if (!common) {
				common = path;
			}
			else {
				if (path != common) {
					common = '*'; // multiple values
				}
			}
		}
		if (common && common != '*') {
			s.basePath = common;
			for (var c=0;c<minCommon;c++) {
				var element = components[c];
				if (element.match(/^v[0123456789].*$/)) {
					s.info.version = element.replace('v','');
				}
			}

			for (var p in s.paths) {
				rename(s.paths,p,p.replace(common,''));
			}

		}
	}
	return s;
}

function processDefs(defs){
	recurseotron.recurse(defs,{},function(obj,state){
		if ((typeof obj == 'object') && (typeof obj.required !== 'undefined')) {
			if (obj.required) {
				var grandparent = state.parents[state.parents.length-2];
				if (!grandparent.required) grandparent.required = [];
				grandparent.required.push(state.key);
			}
			delete obj.required; // TODO move to properties.required array
		}
	});
	return defs;
}

function processHtml(html,options,callback){

	var collection = [];
	var ids = [];

	var defs = {};

	if (html) {
		process.nextTick(function(html,options,callback){

			var $ = cheerio.load(html);
			$.data = function(a,b,c){
				defs = c;
			}

			var t = createSwagger();

			var hostPath = (options.url ? options.urlOrFile : (options.srcUrl ? options.srcUrl : 'http://example.com'));
			var u = up.parse(hostPath);
			t.host = u.host.replace('developer','api'); // TODO is this ok for pre-patching?

			t.info.description = $('div .introText>p').first().text().replace(externalDocsText,'').trim();
			var temp = $('div .introText>p').next().text();
			if (temp) {
				t.externalDocs.description = temp;
			}
			t.externalDocs.url = $('div .introText a').first().attr('href'); // was div .introText>p>a
			if ((t.externalDocs.url && (!t.externalDocs.url.startsWith('http')))) {
				if (options.url) {
					t.externalDocs.url = options.urlOrFile+t.externalDocs.url;
				}
				else if (options.srcUrl) {
					t.externalDocs.url = options.srcUrl+t.externalDocs.url;
				}
			}
			if (!t.externalDocs.url) {
				t.externalDocs.url = options.url ? options.urlOrFile : options.srcUrl;
			}

			$('#apiId>option').each(function(){
				var id = $(this).attr('value');
				if (id) {
					var s = _.cloneDeep(t);
					s.info.title = $(this).text();
					collection.push(s);
					ids.push(id);
				}
			});

			for (var i in ids) {
				var id = ids[i];
				var s = collection[i];
				s.info["x-mashery-id"] = id;
				var apiDesc = $('#apiDescription'+id).text().trim();
				if (apiDesc != noDescription) {
					s.info.description += ' '+apiDesc;
				}
				console.log('%s %s',id,s.info.title);

				var api = $('#api'+id).first();

				defs = {};
				var script = api.find('script').first();
				var scriptText = $(script).html();
				//if (scriptText.startsWith('var apiRootElement =')) {
				eval(scriptText); // ouch that hurts!
				//}

				api.find('li > h3 > span').each(function(){ //selector
					var tag = {};
					tag.name = $(this).text().trim();
					s.tags.push(tag);
				});

				var sec = api.attr('data-auth-type');
				if (sec) {
					var stype = {};
					stype[sec] = [];
					s.security.push(stype);
					if (sec == 'key') {
						s.securityDefinitions[sec] = {};
						s.securityDefinitions[sec].type = 'apiKey';
						s.securityDefinitions[sec].name = 'apikey';
						s.securityDefinitions[sec]["in"] = 'query';
					}
					// TODO oAuth, basic etc
				}

				api.find('li > ul > li > form').each(function(){ //selectors
					var endpointName = $(this).find('input[name="endpointName"]').first().attr('value');
					var methodName = $(this).find('input[name="methodName"]').first().attr('value');
					var httpMethod = $(this).find('input[name="httpMethod"]').first().attr('value').toLowerCase();
					var methodUri = $(this).find('input[name="methodUri"]').first().attr('value');

					if (!methodUri.startsWith('/')) methodUri = '/'+methodUri;
					methodUri = methodUri.split('Δ').join(':');
					methodUri = methodUri.split('Î"').join(':');
					methodUri = methodUri + '/';
					//console.log(methodUri);
					while (methodUri.indexOf(':')>=0) {
						methodUri = methodUri.replace(/:(.+?)([\.\/:\{])/g,function(match,group1,group2){
							group1 = '{'+group1.replace(':','')+'}';
							return group1+group2;
						});
					}
					//console.log(methodUri);
					methodUri = methodUri.replace('/{apiKey}/','/'); // TODO Press Association
					methodUri = methodUri.substr(0,methodUri.length-1);

					if (methodUri.indexOf('.json')>=0) {
						if (s.consumes.indexOf('application/json')<0) {
							s.consumes.push('application/json');
						}
						if (s.produces.indexOf('application/json')<0) {
							s.produces.push('application/json');
						}
					}
					if (methodUri.indexOf('.xml')>=0) {
						if (s.consumes.indexOf('application/xml')<0) {
							s.consumes.push('application/xml');
						}
						if (s.produces.indexOf('application/xml')<0) {
							s.produces.push('application/xml');
						}
					}
					if (methodUri.indexOf('.rss')>=0) {
						if (s.consumes.indexOf('application/xml')<0) {
							s.consumes.push('application/xml');
						}
						if (s.produces.indexOf('application/xml+rss')<0) {
							s.produces.push('application/xml+rss');
						}
					}
					if (methodUri.indexOf('.atom')>=0) {
						if (s.consumes.indexOf('application/xml')<0) {
							s.consumes.push('application/xml');
						}
						if (s.produces.indexOf('application/xml+atom')<0) {
							s.produces.push('application/xml+atom');
						}
					}
					// TODO yaml / rdf ?

					var operationId = (methodName+endpointName).split(' ').join('');

					if (!s.paths[methodUri]) {
						s.paths[methodUri] = {};
					}
					var op = {};
					op.operationId = operationId;
					op.summary = $(this).find('span.description > p').first().text().trim(); //selector
					if (op.summary.length>=50) {
						op.description = op.summary;
						op.summary = op.summary.substr(0,50)+'...';
					}
					s.paths[methodUri][httpMethod] = op;

					op.tags = [];
					op.tags.push(endpointName);
					op.parameters = [];

					var parameters = $(this).find('table.parameters > tbody').first(); // selectors
					parameters.find('tr').each(function(){
						var classVal = $(this).attr('class').trim();

						var name = $(this).find('td.name').first().text().trim();
						name = name.replace('Δ',':');
						name = name.replace('Î"',':');
						name = name.replace('{','').replace('}','');
						var required = $(this).find('td.parameter > input').attr('placeholder');
						var type = $(this).find('td.type').first().text().trim();
						var description = $(this).find('td.description').first().text().trim();

						var parameter = {};
						parameter.name = name.replace(':','');
						parameter.type = type;
						if (parameter.type == 'text') {
							parameter.type = 'string';
						}
						if (parameter.type == 'text box') {
							parameter.type = 'string';
						}
						if (parameter.type == 'ref') {
							parameter.type = 'string';
						}
						if ((parameter.type == 'enumerated') || (parameter.type == 'enum')) {
							parameter.type = 'string';
						}
						if (parameter.type == 'date') {
							parameter.type = 'string';
							parameter.format = 'date';
						}
						if (parameter.type == 'datetime') {
							parameter.type = 'string';
							parameter.format = 'date-time';
						}
						if (parameter.type == 'daterange') {
							parameter.type = 'string';
							// TODO pattern?
						}
						if (parameter.type == 'int') {
							parameter.type = 'integer';
						}
						if (parameter.type == 'num') {
							parameter.type = 'number';
						}
						if ((parameter.type == 'floating point') || (parameter.type == 'float')) {
							parameter.type = 'number';
							parameter.format = 'float';
						}
						if (parameter.type == 'decimal') {
							parameter.type = 'number';
						}
						if (parameter.type == 'array') {
							parameter.items = {};
							parameter.items.type = 'string';
						}
						parameter.description = description; // TODO detect repeatable parameters ('multiple' in description etc)

						parameter["in"] = name.indexOf(':')>=0 ? 'path' : 'query';
						if (classVal.indexOf('type-header')>=0) parameter["in"] = 'header';
						if (classVal.indexOf('type-pathReplace')>=0) parameter["in"] = 'path';

						parameter.required = (parameter["in"] == 'path' ? true : (required == 'required'));

						if ((httpMethod == 'post') && (parameter.type == 'object')) {
							parameter["in"] = 'body';
							delete parameter.type;
							parameter.required = true;
							parameter.schema = {};
							parameter.schema.type = 'object';
						}

						$(this).find('td.parameter > select > option').each(function(){ // selector
							var val = $(this).attr('value');
							if (val) {
								if (!parameter["enum"]) parameter["enum"] = [];
								if (parameter["enum"].indexOf(val)<0) {
									parameter["enum"].push(val);
								}
							}
						});
						if (parameter["enum"] && (parameter["enum"].length==2) && (parameter["enum"].indexOf('true')>=0) &&
							(parameter["enum"].indexOf('false')>=0)) {
							delete parameter["enum"];
							parameter.type = 'boolean';
						}
						if (parameter["enum"] && (parameter["in"] == 'header') && (parameter.name == 'Accept')) {
							if (!op.produces) op.produces = [];
							for (var a in parameter["enum"]) {
								var accept = parameter["enum"][a];
								if (op.produces.indexOf(accept)<0) {
									op.produces.push(accept);
								}
							}
						}

						var defValue = $(this).find('td.parameter > input').first().attr('value'); // selector
						if (defValue) parameter["default"] = defValue;

						if (parameter.name != '') op.parameters.push(parameter);
					});

					methodUri.replace(/(\{.+?\})/g,function(match,group1){
						var param = group1.replace('{','').replace('}','');
						var found = false;
						for (var p in op.parameters) {
							if ((op.parameters[p].name == param) && (op.parameters[p]["in"] == 'path')) found = true;
						}
						if (!found) {
							var newP = {};
							newP.name = param;
							newP.type = 'string';
							newP["in"] = 'path';
							newP.required = true;
							op.parameters.push(newP);
						}
						return group1;
					});

					var oldPath = methodUri;
					methodUri = methodUri + '/';
					for (var p in op.parameters) {
						var param = op.parameters[p];
						if (param["in"] == 'path') {
							if ((methodUri.indexOf(param.name)>=0) && (methodUri.indexOf('{'+param.name+'}')<0)) {
								methodUri = methodUri.replace(param.name+'/','{'+param.name+'}/');
								methodUri = methodUri.replace(param.name+',','{'+param.name+'},');
								methodUri = methodUri.replace(param.name+'.','{'+param.name+'}.'); // TODO regex?
							}
							if (methodUri.indexOf('{'+param.name+'}')<0) {
								param["in"] = 'query'; // in case it's an error
							}
						}
					}
					methodUri = methodUri.substr(0,methodUri.length-1);

					op.responses = {};
					op.responses['200'] = {};
					op.responses['200'].description = 'Success';
					op.responses['400'] = {};
					op.responses['400'].description = 'Bad Request';
					op.responses['403'] = {};
					op.responses['403'].description = 'Forbidden';

					if (methodUri != oldPath) {
						if (s.paths[methodUri]) {
							s.paths[methodUri][httpMethod] = op;
							delete s.paths[oldPath][httpMethod];
						}
						else {
							s.paths[methodUri] = s.paths[oldPath];
							delete s.paths[oldPath];
						}
					}

				});
				optimisePaths(s);

				if (defs) {
					processDefs(defs);
				}
				s.definitions = defs;

			} // end for in ids

			var result = {};
			result.ids = ids;
			result.collection = collection;
			callback({},result);
		},html,options,callback);
	}
	else {
		return false;
	}
}

module.exports = {

	convertIoDocs : function(filename,options,callback){
		// TODO
	},

	convertHtml : function(urlOrFile,options,callback){
		options.urlOrFile = urlOrFile;
		options.url = urlOrFile.indexOf('://')>=3;
		var html = '';
		if (options.url) {
			request(urlOrFile, function (error, response, body) {
				if (error) {
					console.log("Error requesting page: " + error);
					return false;
				}
				var output = urlOrFile.replace('http://','').replace('https://','').replace('/','-');
				if (!output.endsWith('.html')) output += '.html';
				fs.writeFile('./html/'+output,body,'utf8',function(){
					processHtml(body,options,callback);
				});
			});
		}
		else {
			fs.readFile(urlOrFile,'utf8',function(err,html){
				processHtml(html,options,callback);
			});
		}
	}

};

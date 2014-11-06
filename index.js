/*jslint node: true, white: true */

'use strict';

var gutil = require('gulp-util');
var fs = require('fs');
var path = require('path');
var which = require('which');
var through = require('through2');
var spawn = require('win-spawn');
var cheerio = require('cheerio');

module.exports = function (opts) {
	try {
		which.sync('premailer');
	} catch (err) {
		throw new gutil.PluginError('gulp-premailer', 'You need to have Ruby and Premailer installed and in your PATH for this task to work.');
	}

	var stream = through.obj(function (file, enc, done) {
		if (file.isNull()) {
			self.push(file);
			return done();
		}

		if (file.isStream()) {
			self.emit('error', new gutil.PluginError('gulp-premailer', 'Streaming not supported'));
			return done();
		}

		file.contents = new Buffer(file.contents.toString());

		var self = this;
		var errors = '';
		var bufferObjs = [];
		var args = [file.path];

		// Convert JS object to CLI args.. i.e. query-string: foo to
		// --query-string=foo
		if(typeof(opts) == 'object') {
			Object.keys(opts).forEach(function(key) {
				if(opts[key]) {
					args.push('--' + key.replace(/^--/,'') + '=' + opts[key] + '');
				}
			});
		}

		var cp = spawn('premailer', args);

		cp.on('error', function (err) {
			self.emit('error', new gutil.PluginError('gulp-premailer', err));
			self.push(file);
			return done();
		});

		cp.stderr.on('data', function (data) {
			errors += data;
		});

		cp.stdout.on('data', function (data) {
			bufferObjs.push(data);
		});

		cp.on('close', function (code) {
			if (code === 127) {
				self.emit('error', new gutil.PluginError('gulp-premailer', 'You need to have Ruby and Premailer installed and in your PATH for this task to work.'));
				self.push(file);
				return done();
			}

			if (errors) {
				self.emit('error', new gutil.PluginError('gulp-premailer', '\n' + errors.replace('Use --trace for backtrace.\n', '')));
				self.push(file);
				return done();
			}

			if (code > 0) {
				self.emit('error', new gutil.PluginError('gulp-premailer', 'Exited with error code ' + code));
				self.push(file);
				return done();
			}

			file.contents = new Buffer.concat(bufferObjs);
			self.push(file);
			done();
		});
	});

	return stream;
};

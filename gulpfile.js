'use strict';

var jshint = require('gulp-jshint');
var gulp   = require('gulp');

gulp.task('lint', function() {

  return gulp.src([
    'lib/**/*',
    '!trials/**/*',
    '!node_modules/**/*',
    '*.js'
  ])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

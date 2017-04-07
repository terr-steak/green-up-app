
var postcss = require('gulp-postcss');
var gulp = require('gulp');
var autoprefixer = require('autoprefixer');
var cssnano = require('cssnano');
var sass = require('gulp-sass');
var copy = require('gulp-copy');
var clean = require('gulp-clean');


gulp.task('default', function() {
    // place code for your default task here
});

gulp.task('sass', function () {
    var plugins = [
        autoprefixer({browsers: ['last 2 versions']}),
        cssnano()
    ];
    return gulp.src('./scss/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(postcss(plugins))
        .pipe(gulp.dest('./dist/css'));
});

gulp.task('copy', function () {
    var sourceFiles = [ './public/*'];
    return gulp.src(sourceFiles)
        .pipe(gulp.dest('./dist'));
});

gulp.task('clean', function () {
    return gulp.src('./dist', {read: false})
        .pipe(clean());
});

return gulp.src('src/App.js')
  .pipe(webpack( require('./webpack.config.js') ))
  .pipe(gulp.dest('dist/js'));


gulp.task('build', ['clean', 'sass', 'copy']);

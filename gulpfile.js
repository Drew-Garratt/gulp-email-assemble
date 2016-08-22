// ## Globals
var fs           = require('fs');
var path         = require('path');
var del          = require('del');
var colors       = require('colors');

var argv         = require('minimist')(process.argv.slice(2));
var autoprefixer = require('gulp-autoprefixer');
var changed      = require('gulp-changed');
var concat       = require('gulp-concat');
var flatten      = require('gulp-flatten');
var gulp         = require('gulp');
var gulpif       = require('gulp-if');
var imagemin     = require('gulp-imagemin');
//var jshint       = require('gulp-jshint');
//var lazypipe     = require('lazypipe');
//var less         = require('gulp-less');
//var merge        = require('merge-stream');
var cssNano      = require('gulp-cssnano');
var plumber      = require('gulp-plumber');
//var rev          = require('gulp-rev');
var runSequence  = require('run-sequence');
var sass         = require('gulp-sass');
var sourcemaps   = require('gulp-sourcemaps');
var rename       = require('gulp-rename');
var replace      = require('gulp-replace');
var debug        = require('gulp-debug');

var assemble     = require('assemble');
var extname      = require('gulp-extname');
var htmlmin      = require('gulp-htmlmin');
var juice        = require('gulp-juice-concat-enhanced');

var browserSync  = require('browser-sync').create();
var htmlInjector = require("bs-html-injector");

browserSync.use(htmlInjector)

var assmbleApps = [];

var paths = {
  src: './src',
  assemble: './assemble',
  dist: './dist',
  emails: './src/emails',
  shared: './src/shared'
};

var juiceOptions = {
  preserveMediaQueries: true,
  applyAttributesTableElements: true,
  applyWidthAttributes: true,
  preserveImportant: true,
  preserveFontFaces: true,
  webResources: {
    images: false
  }
}

// CLI options
var enabled = {
  // Enable static asset revisioning when `--production`
  rev: argv.production,
  // Disable source maps when `--production`
  maps: !argv.production,
  // Fail styles task on error when `--production`
  failStyleTask: argv.production,
  // Fail due to JSHint warnings only when `--production`
  failJSHint: argv.production,
  // Strip debug statments from javascript when `--production`
  stripJSDebug: argv.production
};


// ### CSS processing pipeline
// Example
// ```
// gulp.src(cssFiles)
//   .pipe(cssTasks('main.css')
//   .pipe(gulp.dest(paths.dist + 'styles'))
// ```
function assembleOutput(dir, type) {
  type = type || 'email';
  
  gulp.task('assembleEmail', function() {
    return assmbleApps[dir].toStream('pages')
      .pipe(debug({title: 'Assemble Email:'}))
      .pipe(assmbleApps[dir].renderFile())
      .pipe(htmlmin())
      .pipe(extname())
      .pipe(rename({
        dirname: dir
      }))
      .pipe(assmbleApps[dir].dest(paths.assemble));
  });
  
  gulp.task('assembleStyles', function() {  
    return gulp.src(path.join(paths.emails, dir, '/styles/**/*.scss'))
      .pipe(debug({title: 'Assemble Sass:'}))
      .pipe(sass({
          outputStyle: 'nested', // libsass doesn't support expanded yet
          precision: 10,
          includePaths: path.join(paths.shared, '/styles')
        })
      )
      .pipe(autoprefixer({
        browsers: [
          'last 2 versions',
          'android 4',
          'opera 12'
        ]})
      )     
      .pipe(rename({
        dirname: dir + '/styles'
      }))
      .pipe(gulp.dest(paths.assemble));
  });
  
  gulp.task('juiceEmail', function() {  
    return gulp.src(path.join(paths.assemble, dir, '/**/*.html'))
      .pipe(debug({title: 'Juice Email:'}))
      .pipe(juice(juiceOptions))
      
      .pipe(replace('[mso_open]', '<!--[if (gte mso 9)|(IE)]>'))
      .pipe(replace('[mso_close]', '<![endif]-->'))
      
      .pipe(replace('[mso_open]', '<!--[if gte mso 11]>'))
      .pipe(replace('[mso_close]', '<![endif]-->'))
      
      .pipe(replace('[mso_open]', '<!--[if !gte mso 11]><!---->'))
      .pipe(replace('[mso_close]', '<!--<![endif]-->'))
      
      .pipe(rename({
        dirname: dir
      }))
      .pipe(gulp.dest(paths.dist));
  });

  
  switch (type) {
    case "email":
      runSequence('assembleEmail','juiceEmail',htmlInjector);
      
      break;
    
    case "styles":
      runSequence('assembleStyles','juiceEmail',htmlInjector);
      
      break;
   
    case "both":
      runSequence('assembleEmail','assembleStyles','juiceEmail',htmlInjector);
      
      break;
  }
};

function processImages(dir) {
  gulp.task('images', function() {
    return gulp.src([path.join(paths.emails, dir, '/images/**/*.{jpeg,jpg,gif,png}'),path.join(paths.shared, '/images/**/*.{jpeg,jpg,gif,png}')])
      .pipe(imagemin({
        progressive: true,
        interlaced: true,
        svgoPlugins: [{removeUnknownsAndDefaults: false}, {cleanupIDs: false}]
      }))
      .pipe(rename({
        dirname: dir + '/images'
      }))
      .pipe(gulp.dest(paths.dist))
      .pipe(browserSync.stream()); 
  }); 
  
  runSequence('images');
}

// ### Get folders for iteration
function getFolders(dir) {
  return fs.readdirSync(dir)
    .filter(function(file) {
      return fs.statSync(path.join(dir, file)).isDirectory();
    });
}

// ### Get current folder of watch type
function getCurrentFolder(filePath,type) {
  var pathArray = filePath.split(path.sep);
  var emailPathPos = pathArray.indexOf(type);
  var currentFolder = pathArray[emailPathPos+1];
  return currentFolder;
}

// ### Assemble App Collection Update
function assembleFolder(dir) {
  //Update Assemble App Sources
  assmbleApps[dir] = assemble();
  assmbleApps[dir].partials([path.join(paths.emails, dir, '/templates/partials/**/*.hbs'),path.join(paths.shared, '/templates/partials/**/*.hbs')]);
  assmbleApps[dir].layouts([path.join(paths.emails, dir, '/templates/layouts/**/*.hbs'),path.join(paths.shared, '/templates/layouts/**/*.hbs')]);
  assmbleApps[dir].pages(path.join(paths.emails, dir, '/templates/email/**/*.hbs'));
  assmbleApps[dir].data([path.join(paths.emails, dir, '/data/**/*.{json,yml}'),path.join(paths.shared, '/data/**/*.{json,yml}')]);
  assmbleApps[dir].option('layout', 'base');
};

// ## Gulp tasks
// Run `gulp -T` for a task summary

// ### Styles
// `gulp styles` - Compiles, combines, and optimizes Bower CSS and project CSS.
// By default this task will only log a warning if a precompiler error is
// raised. If the `--production` flag is set: this task will fail outright.

// ### Images
// `gulp images` - Run lossless compression on all the images.

// ### Clean
// `gulp clean` - Deletes the build folder entirely.
gulp.task('clean', require('del').bind(null, [paths.dist]));

// ### Serve
// `gulp serve` - Use BrowserSync to proxy your dev server and synchronize code
// changes across devices. Specify the hostname of your dev server at
// `manifest.config.devUrl`. When a modification is made to an asset, run the
// build step for that asset and inject the changes into the page.
// See: http://www.browsersync.io
gulp.task('serve', function() {
  // register the plugin
  browserSync.init({
    port: 8080,
    server: "./",
    startPath: "/preview",
    codeSync: false
  });
  //Init Apps
  var folders = getFolders(paths.emails);
  var tasks = folders.map(function(folder) {
    assmbleApps[folder] = assemble();
    assembleFolder(folder);
  });
  
  //Styles Folder Watch
  gulp.watch('src/emails/**/images/**/*.{jpeg,jpg,gif,png}').on('change', function (file) {
    var currentFolder = getCurrentFolder(file.path,'emails');
    
    processImages(currentFolder);   
  });
  
  //Styles Folder Watch
  gulp.watch('src/emails/**/styles/**/*.{scss,less}').on('change', function (file) {
    var currentFolder = getCurrentFolder(file.path,'emails');
      
    assembleOutput(currentFolder,'styles');
  });
  
  //Email Folder Watch
  gulp.watch('src/emails/**/*.{hbs,json,yml}', htmlInjector).on('change', function (file) {
    var currentFolder = getCurrentFolder(file.path,'emails');
    
    switch (file.type) {
      case "added":
        assembleFolder(currentFolder);
        assembleOutput(currentFolder);
        
        break;
        
      case "renamed":
        //Remove old
        var oldPathArray = file.old.split(path.sep);
        var oldFilename = oldPathArray[oldPathArray.length-1];
        oldFilename = oldFilename.substr(0, oldFilename.lastIndexOf('.'));
        
        var oldFilePath = currentFolder + path.sep + oldFilename + ".html";
        var oldDestFilePath = path.resolve(paths.dist, oldFilePath);
        
        del(oldDestFilePath);
        
        //Add new
        assembleFolder(currentFolder);
        assembleOutput(currentFolder);
      
        break;
        
      case "deleted":
        var pathArray = file.path.split(path.sep);
        var filename = pathArray[pathArray.length-1];
        filename = filename.substr(0, filename.lastIndexOf('.'));
        
        var filePath = currentFolder + path.sep + filename + ".html";
        var destFilePath = path.resolve(paths.dist, filePath);
        
        del(destFilePath);
        
        assembleFolder(currentFolder);
        assembleOutput(currentFolder);
      
        break;
        
      case "changed":
        assembleFolder(currentFolder);
        assembleOutput(currentFolder);
      
        break;
    }
  });
  
  //Shared Email Folder Watch
  gulp.watch(path.join(paths.shared, '/**/*.{hbs,json,yml}')).on('change', function (file) {
    var folders = getFolders(paths.emails);
    
    var timeName = 'Shared Email -html changed';
    console.time(timeName);
    
    var tasks = folders.map(function(currentFolder) {
      assembleFolder(currentFolder);
      assembleOutput(currentFolder);
    });
    
    console.timeEnd(timeName);
  });
  
});

// ### Build
// `gulp build` - Run all the build tasks but don't clean up beforehand.
// Generally you should be running `gulp` instead of `gulp build`.
gulp.task('build', function(callback) {
  runSequence('styles',
              'scripts',
              ['fonts', 'images'],
              'assemble',
              callback);
});

// ### Gulp
// `gulp` - Run a complete build. To compile for production run `gulp --production`.
gulp.task('default', ['clean'], function() {
  gulp.start('build');
});

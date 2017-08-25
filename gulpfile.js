var exec = require('child_process').exec
var fs = require('fs');

var gulp = require('gulp');
var gutil = require('gulp-util');

var LIB_PATH = [
  {
    lib: 'lib/ds-chief/',
    files: [
      'DSChief',
      'DSChiefApprovals',
      'DSToken',
      'DSRoles'
    ]
  }
];
var JSON_OUT = 'src/config/';


gulp.task('build', (cb) => {
  LIB_PATH.forEach(path => {
    exec('export SOLC_FLAGS=--optimize && dapp build', { cwd: path.lib }, (err, res, failed) => {
      if (err) {
        console.log(err);
      } else if (failed) {
        process.stdout.write(failed);
      } else {
        process.stdout.write('Compiled library...\n');
      }
    });
  })
  cb();
});

gulp.task('generate', ['build'], (cb) => {
  if (!fs.existsSync(JSON_OUT)){
    fs.mkdirSync(JSON_OUT);
  }
  LIB_PATH.forEach(path => {
    var p = path.lib;
    path.files.forEach(file => {
      var path = `${p}out/${file}`;
      if (fs.existsSync(`${path}.abi`)) {
        var content = fs.readFileSync(`${path}.abi`, "utf8");
        var abi = JSON.parse(content);
        var bytecode = '0x' + fs.readFileSync(`${path}.bin`, "utf8");

        var out = {
          abi,
          bytecode
        };

        fs.writeFileSync(`${JSON_OUT}${file.toLowerCase()}.json`, JSON.stringify(out, null, 2));
        gutil.log(`Wrote to ${JSON_OUT}${file.toLowerCase()}.json`);
      }
    });
  });
});

gulp.task('default', ['build', 'generate']);

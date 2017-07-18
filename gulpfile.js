const gulp = require('gulp');
const watch = require('gulp-watch');
const logger = require('logger');

gulp.task('default', () => {
  gulp.watch('./local_modules/**/*', (obj) => {
    logger.verbose('Cambios realizados');
    if((obj.type === 'changed') || (obj.type === 'added')) {
      gulp.src(obj.path, {
        "base": "./local_modules/"
      })
      .pipe(gulp.dest('./node_modules'));
    }
  });

  logger.info('Iniciando monitoreo gulp');
  return gulp.src('./local_modules/**/*', {
    "base": "./local_modules/"
  })
  .pipe(gulp.dest('./node_modules'));
});

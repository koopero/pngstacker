module.exports = stack

const Promise = require('bluebird')
    , _ = require('lodash')
    , PNG = require('pngjs').PNG
    , mkdirp = Promise.promisify( require('mkdirp') )
    , fs = require('fs')
    , path = require('path')

function stack( seq, options ) {
  var meta

  return createDir()
  .then( () => seq.files )
  .map( loadPNG )
  .then( saveDest )
  .then( finalize )

  function createDir() {
    return mkdirp( path.dirname( seq.dest ) )
  }

  function loadPNG( file ) {
    return Promise.fromCallback( cb => {
      fs.createReadStream( file )
      .pipe( new PNG({

      }))
      .on('metadata', function ( fileMeta ) {
        meta = _.defaults( meta, fileMeta )
        if ( !_.isEqual( meta, fileMeta ) )
          cb( new Error('Metadata mismatch for file '+file ) )
      })
      .on('parsed', function () {
        cb( null, this.data )
      })
    } )
  }

  function saveDest( data ) {
    data = Buffer.concat( data )
    const png = new PNG( meta )
    png.height *= seq.rows
    png.data = data

    return Promise.fromCallback( cb => {
      const stream = fs.createWriteStream( seq.dest )
      png.pack().pipe( stream )
      stream.on('error', err => cb( err ) )
      stream.on('finish', () => cb() )
    })
  }

  function finalize() {
    delete seq.files
    return seq
  }
}

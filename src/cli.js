#!/usr/bin/env node

const _ = require('lodash')
    , Promise = require('bluebird')
    , glob = Promise.promisify( require('glob') )
    , path = require('path')
    , fs = Promise.promisifyAll( require('fs') )

const args = cliArgs()

loadDirs( args.dir )
.map( recognizeFile )
.then( _.filter )
.then( compileSequences )
.mapSeries( ( seq ) => require('./stack')( seq, args ) )
.then( compileMeta )
.then( saveMeta )
.then( ( data ) => console.log( data ))



function cliArgs() {
  const pkg = require('../package.json')
  const ArgumentParser = require('argparse').ArgumentParser
  const parser = new ArgumentParser({
    version: pkg.version,
    addHelp: true,
    description: 'Argparse example'
  })

  parser.addArgument(
    [ 'dir' ],
    {
      nargs: '*',
      defaultValue: ['.']
    }
  )

  parser.addArgument(
    [ '-o' ],
    {
      dest: 'outputDir',
      defaultValue: '.'
    }
  )

  parser.addArgument(
    [ '-m' ],
    {
      dest: 'metaDest'
    }
  )


  return parser.parseArgs()
}



function loadDirs( dirs ) {
  return Promise.map( dirs, function ( dir ) {
    let g = `${dir}${path.sep}**${path.sep}*.png`
    console.log( g )
    return glob( g )
  } )
  .then( ( data ) => _.flatten( data ) )
}

function recognizeFile( file ) {
  let pp = path.parse( file )

  let match = /(.*?)(\d+)\.(\w+)$/.exec( pp.base )

  if ( !match )
    return

  let name = _.trimEnd( match[1], '_.' )
  let seqGlob = _.repeat('?', match[2].length )
  let fullGlob = `${match[1]}${seqGlob}.${match[3]}`

  fullGlob = path.join( pp.root, pp.dir, fullGlob )

  return {
    file, name,
    glob: fullGlob
  }
}

function compileSequences( files ) {

  let seqs = _.uniqBy( files, 'glob' )

  seqs = _.map( seqs, function ( row ) {
    return {
      name: row.name,
      glob: row.glob
    }
  } )

  seqs.map( ( seq ) => {
    let list = _.filter( files, row => row.glob == seq.glob )
    list = _.map( list, row => row.file )
    seq.files = list
  } )

  seqs.map( seq => {
    seq.dest = path.join( args.outputDir, `${seq.name}.png`)
    seq.rows = seq.files.length
  } )

  return seqs
}

function compileMeta( seqs ) {
  return seqs.map( ( seq ) =>
`image/${seq.name}/src: ${seq.dest}
buffer/${seq.name}/rows: ${seq.rows}
`)
  .join('')
}

function saveMeta( meta ) {
  if ( !args.metaDest )
    return meta

  const mkdirp = Promise.promisify( require('mkdirp') )

  let dest = args.metaDest
    , dir  = path.dirname( dest )

  return mkdirp( dir )
  .then( () => fs.writeFileAsync( dest, meta ))
  .then( () => meta )
}

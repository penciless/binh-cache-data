
var expect = require('chai').expect;

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

var { CacheDisk } = require('../lib/cache-disk');
var { PromiseQueue } = require('binh-promise-queue');

describe.only('CacheDisk - Initialization', function() {

    const DIRECTORY_PATH = path.join(__dirname, 'test-data');

    var cache, queue = new PromiseQueue();

    var fspi = queue.interface(fsp);

    before(function(done) {
        cache = new CacheDisk(DIRECTORY_PATH);
        cache.ready(done);
    });

    after(function(done) {
        fsp.rm(DIRECTORY_PATH, { force: true, recursive: true }).then(function() { done(); }).catch(done);
    });

    it('should create or detect a directory including a metafile storing metadata, and a sub-directory to save data', function(done) {
        // Root directory path
        fspi.access(DIRECTORY_PATH, fs.constants.F_OK).then(function(result) {
            console.log('==========1');
            expect(result).to.be.undefined;
        })
        .catch(done);

        // Sub directory path to store data
        fspi.access(path.join(DIRECTORY_PATH, 'data'), fs.constants.F_OK).then(function(result) {
            console.log('==========2');
            expect(result).to.be.undefined;
        })
        .catch(done);

        // Metadata file path
        fspi.access(path.join(DIRECTORY_PATH, 'metafile'), fs.constants.F_OK).then(function(result) {
            console.log('==========3');
            expect(result).to.be.undefined;
            done();
        })
        .catch(done);
        
        // cache.save('id1', { user: 111 }).then(function(result) {
        //     expect(result).to.be.undefined;
        //     done();
        // })
        // .catch(done);
    });

});
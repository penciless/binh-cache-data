
var expect = require('chai').expect;

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

var { CacheDisk } = require('../lib/cache-disk');
var { PromiseQueue } = require('binh-promise-queue');

describe.only('CacheDisk - Initialization', function() {

    const ERROR_EXPECTING_REJECTED_PROMISE = new Error('Expect to get a rejected promise, but got a fulfilled one');
    const ERROR_EXPECTING_RESOLVED_PROMISE = new Error('Expect to get a fulfilled promise, but got a rejected one');

    const DIRECTORY_PATH = path.join(__dirname, 'test-data');

    var cache = new CacheDisk(DIRECTORY_PATH), queue = new PromiseQueue();

    var fspi = queue.interface(fsp);

    before(function(done) {
        cache.ready(done);
    });

    after(function(done) {
        fsp.rm(DIRECTORY_PATH, { force: true, recursive: true }).then(function() { done(); }).catch(done);
    });

    it('should create or detect a directory including a metafile storing metadata, and a sub-directory to save data', function(done) {
        // Root directory path
        fspi.access(DIRECTORY_PATH, fs.constants.F_OK).then(function(result) {
            expect(result).to.be.undefined;
        })
        .catch(done);

        // Sub directory path to store data
        fspi.access(path.join(DIRECTORY_PATH, 'data'), fs.constants.F_OK).then(function(result) {
            expect(result).to.be.undefined;
        })
        .catch(done);

        // Metadata file path
        fspi.access(path.join(DIRECTORY_PATH, 'metafile'), fs.constants.F_OK).then(function(result) {
            expect(result).to.be.undefined;
            // done();
        })
        .catch(done);

        // Create a new cache manager (detect same path)
        new CacheDisk(DIRECTORY_PATH).ready(done);
    });

    it('should save, get, and delete data in cache normally', function(done) {
        // Save a new file
        cache.save('id1', { user: 1 }).then(function(result) {
            expect(result).to.be.undefined;
            expect(cache.size()).to.equal(1);
        })
        .catch(done);

        // Overwrite a file
        cache.save('id1', { user: 111 }).then(function(result) {
            expect(result).to.be.undefined;
            expect(cache.size()).to.equal(1);
        })
        .catch(done);

        // Read file content
        cache.get('id1').then(function(result) {
            expect(result).to.eql({ user: 111 });
            expect(cache.size()).to.equal(1);
        })
        .catch(done);

        // Check file's existence
        cache.has('id1').then(function(result) {
            expect(result).to.be.true;
        })
        .catch(done);

        // Delete a file
        cache.delete('id1').then(function(result) {
            expect(result).to.be.undefined;
            expect(cache.size()).to.equal(0);
        })
        .catch(done);

        // Check file's existence after deleted
        cache.has('id1').then(function(result) {
            expect(result).to.be.false;
        })
        .catch(done);

        // Save a new file with undefined data
        cache.save('id1', undefined).then(function() {
            done(ERROR_EXPECTING_REJECTED_PROMISE);
        })
        .catch(function(error) {
            expect(error).to.be.instanceof(Error);
        })
        .catch(done);

        // Read file content that's undefined
        cache.get('id1').then(function(result) {
            expect(result).to.be.undefined;
            expect(cache.size()).to.equal(0);
        })
        .catch(done);

        // Read file not existing
        cache.get('not-existing-id').then(function(result) {
            expect(result).to.be.undefined;
        })
        .catch(done);

        // Read file not existing
        cache.delete('not-existing-id').then(function() {
            done(ERROR_EXPECTING_REJECTED_PROMISE);
        })
        .catch(function(error) {
            expect(error).to.be.instanceof(Error);
            done();
        })
        .catch(done);

        // Input ID not type of string: considered as an empty string
        expect(cache.id('')).to.equal('_IiI_e');
        expect(cache.id({})).to.equal('_IiI_e');
        expect(cache.id(null)).to.equal('_IiI_e');
    });

    it('should loop through all files in the directory', function(done) {
        cache.save('id1', { user: 111 }).catch(done);
        cache.save('id2', { user: 222 }).catch(done);
        cache.save('id3', { user: 333 }).catch(done);

        var count = 0;
        var ids = ['id1', 'id2', 'id3'];

        cache.loop(function(id, filename, index) {
            expect(id).to.oneOf(ids);
            expect(cache.id(id)).to.equal(filename);
            expect(index).to.equal(count++);
            if (index === ids.length - 1) done();
        });
    });

    it('should forget long-lived inactive files', function(done) {
        cache.forget(5);

        var amount = 10, size = 0;

        for (var i = 0; i < amount; i++) {
            cache.save('id'+i, { user: i }).catch(done);
        }

        cache.get('id9').then(function() {
            size = cache.size();
            expect(size).to.equal(amount);
        }).catch(done);
        
        cache.forget(5);

        var intervalId = setInterval(function() {
            if (cache.size() === (size - 5)) {
                clearInterval(intervalId);
                done();
            }
        });
    });

});

const expect = require('chai').expect;

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const { CacheData } = require('../../lib/cache-data');
const { CacheDisk } = require('../../lib/cache-disk');
const { CacheMemory } = require('../../lib/cache-memory');
const { FakeSourceService } = require('../helpers/FakeSourceService');
const { PromiseQueue } = require('binh-promise-queue');

describe('CacheData - Initialization', function() {

    const ERROR_EXPECTING_REJECTED_PROMISE = new Error('Expect to get a rejected promise, but got a fulfilled one');
    const ERROR_EXPECTING_RESOLVED_PROMISE = new Error('Expect to get a fulfilled promise, but got a rejected one');

    const DIRECTORY_PATH = path.join(__dirname, 'test-data');

    var cache = new CacheData(),
        disk = new CacheDisk(DIRECTORY_PATH),
        memory = new CacheMemory(),
        service = new FakeSourceService(),
        queue = new PromiseQueue();

    var diski = queue.interface(disk);
    var servicei = queue.interface(service);
    var cachei = queue.interface(cache);

    before(function(done) {
        cache.setSource(service);
        cache.setEdges(memory, disk);
        disk.ready(done);
    });

    after(function(done) {
        fsp.rm(DIRECTORY_PATH, { force: true, recursive: true }).then(function() { done(); }).catch(done);
    });

    it('should initialize instance properly', function() {
        var cache1 = new CacheData();

        expect(cache1.getSource()).to.be.undefined;
        cache1.setSource(null);
        expect(cache1.getSource()).to.be.undefined;
        cache1.setSource({});
        expect(cache1.getSource()).to.be.undefined;
        cache1.setSource([]);
        expect(cache1.getSource()).to.be.undefined;

        var sampleValidSource = { get: function(){}, save: function(){}, delete: function(){} };
        cache1.setSource(sampleValidSource);
        expect(cache1.getSource()).to.equal(sampleValidSource);

        cache1.setEdges(memory, disk, null, undefined, [], {}, sampleValidSource);
        var edges = cache1.getEdges();
        expect(edges.length).to.equal(3);
        expect(edges[0]).to.equal(memory);
        expect(edges[1]).to.equal(disk);
        expect(edges[2]).to.equal(sampleValidSource);
    });

    it('cache.get(id) - should cache data from source to all edges', function(done) {
        expect(memory.get('id1')).to.be.undefined;

        diski.get('id1').then(function(data) {
            expect(data).to.be.undefined;
        })
        .catch(done);

        servicei.get('id1').then(function(data) {
            expect(data).to.eql({ num: 111 });
        })
        .catch(done);
        
        cachei.get('id1').then(function(data) {
            expect(data).to.eql({ num: 111 });
            expect(memory.get('id1')).to.eql({ num: 111 });
            expect(memory.has('id1')).to.be.true;
        })
        .catch(done);

        diski.get('id1').then(function(data) {
            expect(data).to.eql({ num: 111 });
        })
        .catch(done);

        diski.has('id1').then(function(data) {
            expect(data).to.be.true;
            done();
        })
        .catch(done);
    });

    it('cache.get(id) - should cache data from source (return value, not async)', function(done) {
        var getOrigin = service.get;

        service.get = function() { return 123; };
        
        cachei.get('anyID').then(function(data) {
            expect(data).to.equal(123);
            expect(memory.get('anyID')).to.equal(123);
            expect(memory.has('anyID')).to.be.true;
        })
        .catch(done);

        diski.get('anyID').then(function(data) {
            expect(data).to.equal(123);
        })
        .catch(done);

        diski.has('anyID').then(function(data) {
            expect(data).to.be.true;
            service.get = getOrigin;
            done();
        })
        .catch(done);
    });

    it('cache.get(id) - should not cache undefined data from source to all edges', function(done) {
        servicei.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
        })
        .catch(done);
        
        cachei.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
            expect(memory.get('noExistId')).to.be.undefined;
            expect(memory.has('noExistId')).to.be.false;
        })
        .catch(done);

        diski.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
        })
        .catch(done);

        diski.has('noExistId').then(function(data) {
            expect(data).to.be.false;
            done();
        })
        .catch(done);
    });

    it('cache.get(id) - should not cache undefined data from source (rejected promise)', function(done) {
        service.setModeReject(true);

        servicei.get('id1').then(function() {
            done(ERROR_EXPECTING_REJECTED_PROMISE);
        })
        .catch(function(error) {
            expect(error).to.be.instanceof(Error);
        })
        .catch(done);
        
        cachei.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
            expect(memory.get('noExistId')).to.be.undefined;
            expect(memory.has('noExistId')).to.be.false;
        })
        .catch(done);

        diski.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
        })
        .catch(done);

        diski.has('noExistId').then(function(data) {
            expect(data).to.be.false;
            service.setModeReject(false);
            done();
        })
        .catch(done);
    });

    it('cache.get(id) - should not cache undefined data from source (return undefined, not async)', function(done) {
        var getOrigin = service.get;

        service.get = function() { return undefined; };
        
        cachei.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
            expect(memory.get('noExistId')).to.be.undefined;
            expect(memory.has('noExistId')).to.be.false;
        })
        .catch(done);

        diski.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
        })
        .catch(done);

        diski.has('noExistId').then(function(data) {
            expect(data).to.be.false;
            service.get = getOrigin;
            done();
        })
        .catch(done);
    });

    it('cache.get(id) - should not cache undefined data from no source (not set a source)', function(done) {
        var cache = new CacheData();

        cache.setEdges(memory, disk);

        cache.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
            expect(memory.get('noExistId')).to.be.undefined;
            expect(memory.has('noExistId')).to.be.false;
        })
        .catch(done);

        disk.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
        })
        .catch(done);

        disk.has('noExistId').then(function(data) {
            expect(data).to.be.false;
            done();
        })
        .catch(done);
    });

    it('cache.get(id) - should get undefined when no source nor edge is set', function(done) {
        var cache = new CacheData();

        cache.get('noExistId').then(function(data) {
            expect(data).to.be.undefined;
            done();
        })
        .catch(done);
    });

});
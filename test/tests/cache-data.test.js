
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
        cache.loggable();
        cache.loggable(false);
        var sampleExceptionEdge = {
            get: function() { var any; any.get(); },
            save: function() { var any; any.save(); },
            delete: function() { var any; any.delete(); }
        };
        cache.setSource(service);
        cache.setEdges(null, undefined, memory, null, sampleExceptionEdge, undefined, disk, null, sampleExceptionEdge, undefined);
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

        servicei.get('id-any').then(function() {
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

    it('cache.save(id, data) - should not save data as undefined', function(done) {
        cache.save('notGonnaSavedID', undefined).then(function() {
            done(ERROR_EXPECTING_REJECTED_PROMISE);
        })
        .catch(function(error) {
            expect(error).to.be.instanceof(Error);
            done();
        });
    });

    it('cache.save(id, data) - should reject/resolve saving data when both source and edges have inconsistent/consistent data', function(done) {
        // Edge data is undefined
        expect(memory.get('id2')).to.be.undefined;

        // Source data is object
        servicei.get('id2').then(function(data) {
            expect(data).to.eql({ num: 222 });
        })
        .catch(done);

        // Save new data with verification (edge and source have different data => rejected > update edges with source data)
        cachei.save('id2', { num: '222' }).then(function() {
            done(ERROR_EXPECTING_REJECTED_PROMISE);
        })
        .catch(function(error) {
            expect(error).to.be.instanceof(Error);

            // Check data at Edge (should be updated same data as Source)
            expect(memory.get('id2')).to.eql({ num: 222 });
            expect(memory.get('id2')).to.not.eql({ num: '222' });
        })
        .catch(done);

        // Check data at Source (should be remaining the same data as before)
        servicei.get('id2').then(function(data) {
            expect(data).to.eql({ num: 222 });
        })
        .catch(done);

        // Save new data AGAIN with verification (edge and source have same data => resovle > update source and edges with new data)
        cachei.save('id2', { num: '222' }).then(function(results) {
            expect(results).to.be.instanceof(Array);
            expect(results[0]).to.be.instanceof(Promise);
            expect(results[results.length - 1]).to.be.instanceof(Promise);
    
            // Check data at Edge
            expect(memory.get('id2')).to.eql({ num: '222' });
            expect(memory.get('id2')).to.not.eql({ num: 222 });
        })
        .catch(done);

        // Check data at Edge (Disk)
        diski.get('id2').then(function(data) {
            expect(data).to.eql({ num: '222' });
        })
        .catch(done);

        // Check data at Source
        servicei.get('id2').then(function(data) {
            expect(data).to.eql({ num: '222' });
        })
        .catch(done);

        // Save AGAIN with the same data - should resolve with an error since data is same, and no need for update
        cachei.save('id2', { num: '222' }).then(function(data) {
            expect(data).to.be.instanceof(Error);
    
            // Check data at Edge
            expect(memory.get('id2')).to.eql({ num: '222' });
        })
        .catch(done);

        // Check data at Source
        servicei.get('id2').then(function(data) {
            expect(data).to.eql({ num: '222' });
            done();
        })
        .catch(done);
    });

    it('cache.save(id, data, { force: true }) - should save data to source and edges without consistency verification', function(done) {
        // Edge data is undefined
        expect(memory.get('id3')).to.be.undefined;

        // Source data is object
        servicei.get('id3').then(function(data) {
            expect(data).to.eql({ num: 333 });
        })
        .catch(done);

        // Save new data without verification
        cachei.save('id3', { num: 'new333' }, { force: true }).then(function(data) {
            expect(data).to.be.instanceof(Array);

            // Check data at Edge (Memory)
            expect(memory.get('id3')).to.eql({ num: 'new333' });
        })
        .catch(done);

        // Check data at Edge (Disk)
        diski.get('id3').then(function(data) {
            expect(data).to.eql({ num: 'new333' });
        })
        .catch(done);

        // Check data at Source
        servicei.get('id3').then(function(data) {
            expect(data).to.eql({ num: 'new333' });
            done();
        })
        .catch(done);
    });

    it('cache.save(id, data) - should save data edges without any declared source', function(done) {
        var cache = new CacheData();

        cache.setEdges(memory, disk);

        var cachei = queue.interface(cache);

        // Edge data is undefined
        expect(memory.get('anyId1')).to.be.undefined;

        // Edge data is undefined
        diski.get('anyId1').then(function(data) {
            expect(data).to.be.undefined;
        })
        .catch(done);

        // Save new data without verification
        cachei.save('anyId1', { num: 'any11' }, { force: true }).then(function(data) {
            expect(data).to.be.instanceof(Array);

            // Check data at Edge (memory)
            expect(memory.get('anyId1')).to.eql({ num: 'any11' });
        })
        .catch(done);

        // Check data at Edge (disk)
        diski.get('anyId1').then(function(data) {
            expect(data).to.eql({ num: 'any11' });
        })
        .catch(done);

        // Save new data with verification
        cachei.save('anyId1', { num: 'any12' }).then(function(data) {
            expect(data).to.be.instanceof(Array);

            // Check data at Edge (memory)
            expect(memory.get('anyId1')).to.eql({ num: 'any12' });
        })
        .catch(done);

        // Check data at Edge (disk)
        diski.get('anyId1').then(function(data) {
            expect(data).to.eql({ num: 'any12' });
            done();
        })
        .catch(done);
    });

    it('cache.delete(id) - should remove data associated with ID from edges', function(done) {
        var id = 'id1', current_data = { num: 111 };

        cachei.get(id).then(function(data) {
            expect(data).to.eql(current_data);
            expect(memory.get(id)).to.eql(current_data);
        });

        diski.get(id).then(function(data) {
            expect(data).to.eql(current_data);
            cache.delete(id);
        })
        .catch(done);

        var verifying = false, start = Date.now();
        var intervalID = setInterval(function() {
            if (verifying) return;
            verifying = true;

            if (Date.now() - start > 1800) {
                clearInterval(intervalID);
                done(new Error('Timeout for interval verification'));
            }
            else Promise.all([disk.get(id), service.get(id)]).then(function(values) {
                verifying = false;

                var disk_data = values[0], source_data = values[1];

                if (disk_data === undefined && source_data instanceof Object && source_data.num === 111) {
                    clearInterval(intervalID);
                    expect(disk_data).to.be.undefined;
                    expect(source_data).to.eql({ num: 111 });
                    done();
                }
            })
            .catch(done);
        });
    });

    it('cache.delete(id, include_source) - should remove data from both source and edges', function(done) {
        var id = 'id4', current_data = { num: 444 };

        cachei.get(id).then(function(data) {
            expect(data).to.eql(current_data);
            expect(memory.get(id)).to.eql(current_data);
        });

        diski.get(id).then(function(data) {
            expect(data).to.eql(current_data);
            cache.delete(id, true); // true: include source
        })
        .catch(done);

        var verifying = false, start = Date.now();
        var intervalID = setInterval(function() {
            if (verifying) return;
            verifying = true;

            if (Date.now() - start > 1800) {
                clearInterval(intervalID);
                done(new Error('Timeout for interval verification'));
            }
            else Promise.all([disk.get(id), service.get(id)]).then(function(values) {
                verifying = false;

                var disk_data = values[0], source_data = values[1];

                if (disk_data === undefined && source_data === undefined) {
                    clearInterval(intervalID);
                    expect(disk_data).to.be.undefined;
                    expect(source_data).to.be.undefined;
                    done();
                }
            })
            .catch(done);
        });
    });

    it('cache.forget(amount) - should remove old data from edges only (not included source)', function(done) {
        cachei.get('id5').catch(done);
        cachei.get('id6').catch(done);
        cachei.get('id7').catch(done);
        cachei.get('id8').catch(done);

        cachei.get('id9').then(function(data) {
            expect(data).to.eql({ num: 999 });
            expect(memory.size() > 0).to.be.true;
        })
        .catch(done);

        diski.get('id9').then(function(data) {
            expect(disk.size() > 0).to.be.true;
            expect(disk.size()).to.equal(memory.size());
            var size = memory.size();
            expect(size - 2 > 0).to.be.true;
            cache.forget(size - 2);
        })
        .catch(done);

        var verifying = false, start = Date.now();
        var intervalID = setInterval(function() {
            if (verifying) return;
            verifying = true;

            if (Date.now() - start > 1800) {
                clearInterval(intervalID);
                done(new Error('Timeout for interval verification'));
            }
            else Promise.all([disk.get('id5'), service.get('id5')]).then(function(values) {
                verifying = false;

                var disk_data = values[0], source_data = values[1];

                if (memory.size() === 2 && disk.size() === 2 && disk_data === undefined && source_data instanceof Object && source_data.num === 555) {
                    clearInterval(intervalID);
                    expect(memory.get('id5')).to.be.undefined;
                    expect(disk_data).to.be.undefined;
                    expect(source_data).to.eql({ num: 555 });
                    done();
                }
            })
            .catch(done);
        });
    });

    it('cache.forget(callback) - should access to cache edges to customize how data is forgotten', function() {
        cache.forget(function(edges) {
            expect(edges[0]).to.equal(memory);
            expect(edges[2]).to.equal(disk);
        });
    });

});

const assert = require('assert');
const { CacheDisk } = require("./cache-disk");
const { CacheMemory } = require("./cache-memory");

function CacheData() {
    var source, edges = [], logConsole = function(){};

    this.loggable = function(flag) {
        logConsole = flag === false ? function(){} : console.log;
    };

    this.setSource = function(input) {
        if (validCache(input)) {
            source = input;
        }
    };

    this.getSource = function() {
        return source;
    };

    this.setEdges = function() {
        for (var i in arguments) {
            var edge = arguments[i];
            if (validCache(edge)) {
                edges.push(edge);
            };
        }
    };

    this.getEdges = function() {
        return edges.slice(0); // clone new array
    };

    function validCache(object) {
        var valid = true;

        if (object == undefined) return false;
        if (object instanceof CacheMemory || object instanceof CacheDisk) return true;

        var methods = ['get', 'save', 'delete'],
            length = methods.length;

        for (var i = 0; i < length; i++) {
            if (!(object[methods[i]] instanceof Function)) {
                valid = false;
                break;
            }
        }

        return valid;
    }

    this.get = function(id) {
        var finalize;
        return new Promise(function(resolve) {
            finalize = resolve;
            getRecursively(id, 0, resolve);
        })
        .then(function(result) {
            if (result !== undefined) {
                var index = finalize.index + 1;
                for (var i = 0; i < index; i++) {
                    saveToCache(edges[i], id, result, i);
                }
            }
            return result;
        });
    };

    function getRecursively(id, index, finalize) {
        var edge;

        if (Number.isFinite(index)) {
            edge = edges[index];
            finalize.index = index;
        }
        else {
            edge = index;
            index = NaN;
        }

        try {
            var result = edge.get(id);
            if (result instanceof Promise) {
                result.then(function(data) {
                    if (data === undefined) getNextCache(id, index, finalize);
                    else finalize(data);
                },
                function() {
                    getNextCache(id, index, finalize);
                });
            }
            else if (result === undefined) {
                getNextCache(id, index, finalize);
            }
            else {
                finalize(result);
            }
        }
        catch (error) {
            logConsole(`[CacheData] Error getting data from cache[${index}]: ${error}`);
            getNextCache(id, index, finalize);
        }
    }

    function getNextCache(id, index, finalize) {
        if (index + 1 < edges.length) {
            getRecursively(id, ++index, finalize);
        }
        else if (index + 1 >= edges.length && source && source instanceof Object) {
            getRecursively(id, source, finalize);
        }
        else {
            finalize(undefined);
        }
    }

    this.save = function(id, data, options) {
        return new Promise(function(resolve, reject) {
            if (data === undefined) return reject(new Error('Not being saved since data is undefined'));

            if (options && options.force === true) {
                saveToEdges(id, data);
                saveToSource(id, data);
                resolve();
            }
            else if (source) saveAfterVerified(id, data).then(resolve, reject)
            else {
                saveToEdges(id, data);
                resolve();
            }
        });
    };

    function saveAfterVerified(id, data) {
        return new Promise(function(resolve, reject) {
            var sourcePromise = new Promise(function(resolve) {
                getRecursively(id, source, resolve);
            });
    
            var edgePromise = new Promise(function(resolve) {
                getRecursively(id, edges[0], resolve);
            });
    
            Promise.all([sourcePromise, edgePromise]).then(function(values) {
                var source = values[0], edge = values[1];

                if (deepEqual(edge, source)) {
                    if (deepEqual(edge, data)) return resolve(new Error('Data remains the same as source and cache'));
                    saveToEdges(id, data);
                    saveToSource(id, data);
                    resolve();
                }
                else {
                    saveToEdges(id, source);
                    reject(new Error('Data from source and cache are inconsistent'));
                }
            });
        });
    }

    function saveToEdges(id, data) {
        edges.forEach(function(edge, index) {
            saveToCache(edge, id, data, index);
        });
    }

    function saveToSource(id, data) {
        saveToCache(source, id, data, 'source');
    }

    function saveToCache(cache, id, data, label) {
        try {
            cache.save(id, data);
        }
        catch (error) {
            logConsole(`[CacheData] Error saving data to cache[${label}]: ${error}`);
        }
    }

    this.delete = function(id, include_source) {
        var caches = include_source === true && source ? edges.concat([source]) : edges;

        caches.forEach(function(cache, index) {
            try {
                cache.delete(id);
            }
            catch (error) {
                logConsole(`[CacheData] Error deleting data in cache[${index}]: ${error}`);
            }
        });
    };

    this.forget = function(input) {
        if (input instanceof Function) input(edges.slice(0));
        else edges.forEach(function(edge, index) {
            try {
                edge.forget(input);
            }
            catch (error) {
                logConsole(`[CacheData] Error forgetting data in cache[${index}]: ${error}`);
            }
        });
    };
}

function deepEqual(a, b) {
    try {
        assert.deepStrictEqual(a, b);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = { CacheData };

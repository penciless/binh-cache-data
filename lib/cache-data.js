
const assert = require('assert');
const { CacheDisk } = require("./cache-disk");
const { CacheMemory } = require("./cache-memory");

function CacheData() {
    var source, edges = [], logConsole = function(){};

    this.loggable = function(flag) {
        logConsole = flag === false ? function(){} : console.log;
    };

    this.setSource = function(input) {
        source = validCache(input) ? input : undefined;
    };

    this.getSource = function() {
        return source;
    };

    this.setEdges = function() {
        edges = [];
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
        return new Promise(function(resolveFinal) {
            var finalize;
            new Promise(function(resolve) {
                finalize = resolve;
                getFromEdge(id, 0, resolve);
            })
            .then(function(result) {
                getFromSourceIfUndefined(id, result).then(function(result) {
                    if (result !== undefined) {
                        var index = finalize.index + 1;
                        for (var i = 0; i < index; i++) {
                            proccessCache(edges[i], i, 'save', [id, result]);
                        }
                    }
                    resolveFinal(result);
                });
            });
        });
    };

    function getFromSourceIfUndefined(id, result) {
        return new Promise(function(resolve) {
            if (result === undefined) {
                getFromEdge(id, source, resolve);
            }
            else resolve(result);
        });
    }

    function getFromEdge(id, index, finalize) {
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
            logConsole(`Failed to get data at cache[${getIndexLabel(index)}]: ${error}`);
            getNextCache(id, index, finalize);
        }
    }

    function getNextCache(id, index, finalize) {
        if (index + 1 < edges.length) {
            getFromEdge(id, ++index, finalize);
        }
        else {
            finalize(undefined);
        }
    }

    this.save = function(id, data, options) {
        return new Promise(function(resolve, reject) {
            if (data === undefined) return reject(new Error('Not being saved since data is undefined'));

            if (source && options && options.force === true) {
                saveToBothSourceAndEdges(id, data, resolve, reject);
            }
            else if (source) {
                saveAfterVerified(id, data).then(resolve, reject);
            }
            else {
                saveToEdges(id, data, resolve);
            }
        });
    };

    function saveAfterVerified(id, data) {
        return new Promise(function(resolve, reject) {
            var sourcePromise = new Promise(function(resolve) {
                getFromEdge(id, source, resolve);
            });
    
            var edgePromise = new Promise(function(resolve) {
                getFromEdge(id, 0, resolve);
            });
    
            Promise.all([sourcePromise, edgePromise]).then(function(values) {
                var source = values[0], edge = values[1];

                if (deepEqual(edge, source)) {
                    if (deepEqual(edge, data)) return resolve(new Error('Data remains the same as source and cache'));
                    saveToBothSourceAndEdges(id, data, resolve, reject);
                }
                else {
                    saveToEdges(id, source, function() {
                        reject(new Error('Data from source and cache are inconsistent'));
                    });
                }
            });
        });
    }

    function saveToBothSourceAndEdges(id, data, resolve, reject) {
        saveToSource(id, data).then(function() {
            saveToEdges(id, data, resolve);
        }, reject);
    }

    function saveToEdges(id, data, resolve) {
        var promises = [];

        edges.forEach(function(edge, index) {
            promises.push(proccessCache(edge, index, 'save', [id, data]));
        });

        resolve(promises);
    }

    function saveToSource(id, data) {
        return proccessCache(source, edges.length, 'save', [id, data]);
    }

    this.delete = function(id, include_source) {
        return new Promise(function(resolve) {
            var promises = [],
                caches = include_source === true && source ? edges.concat([source]) : edges;
            
            caches.forEach(function(cache, index) {
                promises.push(proccessCache(cache, index, 'delete', [id]));
            });

            resolve(promises);
        });
    };

    this.forget = function(input) {
        return new Promise(function(resolve) {
            var promises = [];
            
            if (input instanceof Function) input(edges.slice(0));
            else edges.forEach(function(edge, index) {
                promises.push(proccessCache(edge, index, 'forget', [input]));
            });

            resolve(promises);
        });
    };

    function proccessCache(cache, index, method, args) {
        try {
            var output = cache[method].apply(cache, args);
            return output instanceof Promise ? output : Promise.resolve(output);
        }
        catch (error) {
            var message = `Failed to ${method} data at cache[${getIndexLabel(index)}]: ${error}`;
            logConsole(message);
            var reason = new Error(message);
            reason.error = error;
            return Promise.reject(reason);
        }
    }

    function getIndexLabel(index) {
        return index < edges.length ? index : 'source';
    }
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

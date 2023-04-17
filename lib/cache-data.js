
const { CacheDisk } = require("./cache-disk");
const { CacheMemory } = require("./cache-memory");

function CacheData() {

    var cache = this, source, edges = [];

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
        var refResolve;
        return new Promise(function(resolve) {
            refResolve = resolve;
            getRecursively(id, 0, resolve);
        })
        .then(function(result) {
            if (result !== undefined) {
                var index = refResolve.index;
                for (var i = 0; i < index; i++) {
                    edges[i].save(id, result);
                }
            }
            return result;
        })
        .catch(function(){});
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

        if (edge && edge.get instanceof Function) {
            var result = edge.get(id);
            result instanceof Promise ? result.then(function(data) {
                if (data === undefined && index < edges.length) getRecursively(id, ++index, finalize);
                else finalize(data);
            },
            function() { 
                if (index < edges.length) getRecursively(id, ++index, finalize);
                else finalize(undefined);
            })
            :
            result === undefined && index < edges.length ? getRecursively(id, ++index, finalize) : finalize(result);
        }
        else if (index < edges.length) {
            getRecursively(id, ++index, finalize);
        }
        else if (finalize.index >= edges.length && source && source instanceof Object) {
            getRecursively(id, source, finalize);
        }
        else {
            finalize(undefined);
        }
    }

    this.save = function(id, data, options) {
        return new Promise(function(resolve, reject) {
            if (data === undefined) return reject(new Error('Not being saved since data is undefined'));

            if (options.force === true) {
                saveToEdges(id, data);
                if (source) saveToSource(id, data);
            }
            else if (source) saveAfterVerified(id, data).then(resolve, reject)
            else saveToEdges(id, data);
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
    
                if (JSON.stringify(edge) === JSON.stringify(source)) {
                    saveToEdges(id, data);
                    saveToSource(id, data);
                    resolve();
                }
                else {
                    saveToEdges(id, source);
                    reject(new Error('Data between source and edge is inconsistent'));
                }
            });
        });
    }

    function saveToEdges(id, data) {
        edges.forEach(function(edge) {
            if (edge && edge.save instanceof Function) edge.save(id, data);
        });
    }

    function saveToSource(id, data) {
        if (source && source.save instanceof Function) source.save(id, data);
    }

    // TODO
    // 1. write testings
    // 2. implement delete()
    // 3. implement forget() - only for edges, not source
    // 4. clean code - remove verification of methods (.get/.save/etc.) in object
}

module.exports = { CacheData };

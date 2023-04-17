
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const { PromiseQueue } = require('binh-promise-queue');

const DEFAULT_CACHE_DIRECTORY = path.join(require.main.path, 'cache-disk');

function CacheDisk(init_path) {
    var cache = this,
        cache_directory = init_path || DEFAULT_CACHE_DIRECTORY,
        data_directory = path.join(cache_directory, 'data'),
        meta_file = path.join(cache_directory, 'metafile'),
        size = 0, metadata, is_saving_metadata = false, last_saving_metadata;

    const queue = new PromiseQueue();
    queue.throwable(false);
    
    // const fspi = queue.interface(fsp);
    const createDirectory = queue.interface(fsp.mkdir);
    const openDirectory = queue.interface(fsp.opendir);
    const accessFile = queue.interface(fsp.access);
    const readFile = queue.interface(fsp.readFile);
    const writeFile = queue.interface(fsp.writeFile);
    const removeFile = queue.interface(fsp.unlink);
    const removePath = queue.interface(fsp.rm);
    const statFile = queue.interface(fsp.stat);

    createDirectory(data_directory, { recursive: true });

    loadMetadata();
    
    var initialized = saveMetadata();

    cache.ready = function(callback) {
        initialized.then(callback);
    };

    function loadMetadata() {
        readFile(meta_file, { encoding: 'utf8', flag: 'r' }).then(parseJSON, function() { return undefined; }).then(function(data) {
            data = data instanceof Object ? data : {};
            var first = typeof data.first === 'number' && data.first > 0 ? data.first : Date.now();
            var last = typeof data.last === 'number' && data.last > 0 ? data.last : Date.now();
            var size = typeof data.size === 'number' && data.size >= 0 ? data.size : 0;
            metadata = { first, last, size };
        });
    }

    function saveMetadata() {
        if (is_saving_metadata) return last_saving_metadata;
        is_saving_metadata = true;
        return last_saving_metadata = writeFile.args(function() {
            is_saving_metadata = false;
            return [meta_file, JSON.stringify(metadata), { encoding: 'utf8', flag: 'w' }];
        });
    }

    function pathFile(id) {
        return path.join(data_directory, encode(id));
    }

    function encode(id) {
        id = typeof id === 'string' ? id : '';
        var filename = '_' + Buffer.from(JSON.stringify(id)).toString('base64').replace(/\+/g, '_p').replace(/\=/g, '_e').replace(/\//g, '_f');
        return filename;
    }

    function decode(filename) {
        if (typeof filename !== 'string') return '';

        var id = '';

        try {
            filename = filename.slice(1);
            filename = filename.replace(/_p/g, '+').replace(/_e/g, '=').replace(/_f/g, '/');
            filename = Buffer.from(filename, 'base64').toString('utf8');
            id = JSON.parse(filename);
        }
        catch (e) {}
        
        return id;
    }

    function parseJSON(input) {
        try {
            return JSON.parse(input);
        }
        catch (e) {
            return input;
        }
    }

    cache.id = encode;

    cache.size = function() {
        return metadata.size;
    };

    function increaseSize() {
        if (metadata.size < 0) metadata.size = 0;
        metadata.size++;
        metadata.last = Date.now();
        return saveMetadata();
    };

    function decreaseSize() {
        metadata.size--;
        if (metadata.size < 0) metadata.size = 0;
        return saveMetadata();
    };

    cache.get = function(id) {
        return readFile(pathFile(id), { encoding: 'utf8', flag: 'r' }).then(parseJSON, function() { return undefined; });
    };

    cache.save = function(id, data) {
        var existed = false, filepath = pathFile(id);

        accessFile(filepath, fs.constants.F_OK).then(function() {
            existed = true;
        });

        return writeFile(filepath, JSON.stringify(data), { encoding: 'utf8', flag: 'w' }).then(function() {
            if (!existed) increaseSize();
        });
    };

    cache.has = function(id) {
        return accessFile(pathFile(id), fs.constants.F_OK).then(function() { return true; }, function() { return false; });
    };

    cache.delete = function(id) {
        return removeFile(pathFile(id)).then(function() { decreaseSize(); });
    };

    var forgetquota = 0, forgetting = false;

    cache.forget = function(amount) {
        openDirectory(data_directory, { encoding: 'utf8', bufferSize: 32 }).then(function(dir) {
            amount = typeof amount === 'number' && amount > 0 ? amount : 0;
            forgetquota = Math.max(amount, forgetquota);
    
            if (forgetting || forgetquota <= 0 || invalidLoop()) return;
            
            forgetting = true;
    
            function invalidLoop() {
                if (forgetquota > metadata.size) {
                    if (stopRef instanceof Function) stopRef();
                    cache.empty().then(function() {
                        forgetquota = 0;
                        forgetting = false;
                    }).now();
                    return true;
                }
                return false;
            }
    
            function finalize() {
                if (stopRef instanceof Function) stopRef();
                forgetting = false;
                saveMetadata();
            }
    
            var stopRef, not_deleted = 0;
    
            var { first, last } = metadata;
    
            var min = Math.min(first, last),
                threshold = Math.max(first, last),
                delta = threshold - min;
    
            if (delta > 2) threshold = min + (delta / 2);

            eachFile(dir, function(filename, stop, next) {
                stopRef = stop;

                if (invalidLoop()) return;

                if (stop === true) { // no more file
                    finalize();
                    metadata.size = Math.max(0, metadata.size, not_deleted);
                    if (forgetquota > 0 && metadata.size > 0) {
                        metadata.first = parseInt(threshold);
                        cache.forget();
                    }
                    return;
                }

                var filepath = path.join(data_directory, filename);

                fsp.stat(filepath).then(function(stats) {
                    if (stats.mtimeMs <= threshold) {
                        fsp.unlink(filepath).then(function() {
                            metadata.size--;
                            if (--forgetquota > 0) return next();
                            finalize();
                        })
                        .catch(finalize);
                    }
                    else {
                        not_deleted++;
                        next();
                    }
                })
                .catch(finalize);
            });
        });
    };

    function eachFile(dir, callback) {
        dir.read().then(function(dirent) {
            if (!dirent) {
                dir.close();
                callback(undefined, true);
                return;
            }

            if (!dirent.isFile()) eachFile(dir, callback);
            
            var ended = false, continued = false;

            function stop() {
                ended = true;
                dir.close();
            }

            function next() {
                if (continued || ended) return;
                continued = true;
                eachFile(dir, callback);
            }

            callback(dirent.name, stop, next);
        });
    }

    cache.loop = function(callback) {
        openDirectory(data_directory, { encoding: 'utf8', bufferSize: 32 }).then(function(dir) {
            var index = 0;
            eachFile(dir, function(filename, stop, next) {
                if (stop === true) return;
                var id = decode(filename);
                callback(id, filename, index++, stop, next);
                callback.length < 5 ? next() : null;
            });
        });
    };

    cache.empty = function() {
        return removePath(data_directory, { force: true, recursive: true }).then(function() {
            var current = Date.now();
            metadata.size = 0;
            metadata.first = current;
            metadata.last = current;
            initialized = saveMetadata().now();
            createDirectory(data_directory, { recursive: true }).now();
        });
    };

}

module.exports = { CacheDisk };

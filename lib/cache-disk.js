
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
        size = 0, metadata;

    const queue = new PromiseQueue();
    queue.throwable(false);
    
    // const fspi = queue.interface(fsp);
    const createDirectory = queue.interface(fsp.mkdir);
    const openDirectory = queue.interface(fsp.opendir);
    const accessFile = queue.interface(fsp.access);
    const readFile = queue.interface(fsp.readFile);
    const writeFile = queue.interface(fsp.writeFile);
    const removeFile = queue.interface(fsp.unlink);

    createDirectory(data_directory, { recursive: true });

    loadMetadata();
    
    var initialized = saveMetadata();

    cache.ready = function(callback) {
        initialized.then(callback);
    };

    function loadMetadata() {
        readFile(meta_file, { encoding: 'utf8', flag: 'r' }).then(parseJSON, function() { return undefined; })
            .then(function(data) {
                data = data instanceof Object ? data : {};
                metadata = {
                    first: data.first || null,
                    last: data.last || null,
                    size: data.size || 0
                };
            });
    }

    function saveMetadata() {
        return writeFile.args(function() {
            return [meta_file, JSON.stringify(metadata), { encoding: 'utf8', flag: 'w' }];
        });
    }

    function pathFile(filename) {
        return path.join(data_directory, encode(filename));
    }

    function encode(id) {
        try {
            id = '_' + Buffer.from(JSON.stringify(id)).toString('base64').replace(/\+/g, '_p').replace(/\=/g, '_e').replace(/\//g, '_f');
        }
        catch (e) {
            id = '_invalid_filename';
        }
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

    cache.size = function() {
        return metadata.size;
    };

    function increaseSize() {
        metadata.size++;
        var saving = saveMetadata();
        queue.takeover();
        return saving;
    };

    function decreaseSize() {
        metadata.size--;
        var saving = saveMetadata();
        queue.takeover();
        return saving;
    };

    cache.get = function(id) {
        return readFile(pathFile(id), { encoding: 'utf8', flag: 'r' }).then(parseJSON, function() { return undefined; });
    };

    cache.save = function(id = '', data) {
        var existed = false, filepath = pathFile(id);

        accessFile(filepath, fs.constants.F_OK).then(function() {
            existed = true;
        });

        return writeFile(filepath, JSON.stringify(data), { encoding: 'utf8', flag: 'w' }).then(function() {
            if (!existed) increaseSize();
        });
    };

    cache.has = function(id = '') {
        return accessFile(pathFile(id), fs.constants.F_OK).then(function() { return true; }, function() { return false; });
    };

    cache.delete = function(id) {
        return removeFile(pathFile(id)).then(function() { decreaseSize(); });
    };

    cache.deleteBy = function(condition) {
    };

    cache.forget = function(amount) {
    };

    cache.loop = function(callback) {
        openDirectory(data_directory, { encoding: 'utf8', bufferSize: 32 }).then(function(dir) {
            readDir(dir, callback);
        });
    };

    cache.empty = function() {
    };

    function readDir(dir, callback) {
        dir.read().then(function(dirent) {
            if (!dirent) return dir.close();
            if (dirent.isFile()) callback(getDirentData.bind({ filename: dirent.name }), dirent.name);
            readDir(dir);
        });
    }

    function getDirentData() {
        return cache.get(this.filename);
    }
}

module.exports = { CacheDisk };

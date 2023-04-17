
function FakeSourceService() {
    var alwaysReject = false;

    var cache = {
        id1: { num: 111 },
        id2: { num: 222 },
        id3: { num: 333 },
        id4: { num: 444 },
        id5: { num: 555 },
        id6: { num: 666 },
        id7: { num: 777 },
        id8: { num: 888 },
        id9: { num: 999 }
    };

    this.setModeReject = function(flag) {
        alwaysReject = !!flag;
    };

    this.get = function(id) {
        return new Promise(function(resolve, reject) {
            if (alwaysReject) reject(new Error('sample'));
            else resolve(cache[id]);
        });
    };

    this.save = function(id, data) {
        return new Promise(function(resolve, reject) {
            if (alwaysReject) reject();
            else {
                cache[id] = data;
                resolve();
            }
        });
    };

    this.delete = function(id) {
        return new Promise(function(resolve, reject) {
            delete cache[id];
            resolve();
        });
    };
}

module.exports = {
    FakeSourceService
};

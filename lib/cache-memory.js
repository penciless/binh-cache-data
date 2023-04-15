
function CacheMemory() {
    var first, last, cache = {}, size = 0;

    this.size = function() {
        return size;
    };

    this.has = has;

    this.id = normalizeID;

    this.get = function(id) {
        id = normalizeID(id);
        if (!has(id)) return undefined;
        var record = cache[id];
        removeRecordPosition(record);
        appendRecordToLast(record);
        return record.data;
    };

    this.save = function(id, data) {
        id = normalizeID(id);
        if (has(id)) removeRecord(cache[id]);
        appendRecord({ id, data });
    };

    this.delete = function(id) {
        id = normalizeID(id);
        if (has(id)) removeRecord(cache[id]);
    };

    this.forget = function(amount) {
        if (amount <= 0) return 0;

        if (amount >= size) {
            var count = size;
            this.empty(); // size = 0
            return count;
        }

        var count = 0, record = first;

        while (count < amount) {
            ++count;
            delete cache[record.id];
            record = record.next;
        }

        record.prev = null;
        first = record;
        size -= count;
        
        return count;
    };

    this.loop = function(callback) {
        if (size <= 0) return;

        var record = first, index = 0;

        while (record) {
            callback(record.id, record.data, index++);
            record = record.next;
        }
    };

    this.empty = function() {
        first = null;
        last = null;
        cache = {};
        size = 0;
    };

    function appendRecord(record) {
        appendRecordToLast(record);
        cache[record.id] = record;
        ++size;
    }

    function appendRecordToLast(record) {
        if (!first && !last) {
            first = record;
            last = record;
            record.prev = null;
            record.next = null;
        }
        else {
            record.prev = last;
            record.next = null;
            last.next = record;
            last = record;
        }
    }

    function removeRecord(record) {
        removeRecordPosition(record);
        delete cache[record.id];
        --size;
    }

    function removeRecordPosition(record) {
        if (record === first && first === last) {
            first = null;
            last = null;
        }
        else if (record === first) {
            first = record.next;
            first.prev = null;
        }
        else if (record === last) {
            last = record.prev;
            last.next = null;
        }
        else if (record.prev && record.next) {
            record.prev.next = record.next;
            record.next.prev = record.prev;
        }
    }

    function has(id) {
        return cache.hasOwnProperty(id);
    }

    function normalizeID(id) {
        return typeof id === 'string' ? id : '';
    }
}

module.exports = { CacheMemory };

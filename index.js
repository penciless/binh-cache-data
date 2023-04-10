/*!
 * binh-promise-queue
 * Copyright(c) 2023 Nguyen Duc Binh <binh.ng1195@gmail.com>
 * MIT Licensed
 */

'use strict';

const { CacheData } = require('./lib/cache-data');
const { CacheMemory } = require('./lib/cache-memory');
const { CacheDisk } = require('./lib/cache-disk');

module.exports = {
    CacheData,
    CacheMemory,
    CacheDisk
};

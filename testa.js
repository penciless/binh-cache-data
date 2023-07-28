
// function encode(id) {
//     id = typeof id === 'string' ? id : '';
//     var filename = '_' + Buffer.from(JSON.stringify(id)).toString('base64').replace(/\+/g, '_p').replace(/\=/g, '_e').replace(/\//g, '_f');
//     return filename;
// }


// function decode(filename) {
//     if (typeof filename !== 'string') return '';

//     var id = '';

//     try {
//         filename = filename.slice(1);
//         filename = filename.replace(/_p/g, '+').replace(/_e/g, '=').replace(/_f/g, '/');
//         filename = Buffer.from(filename, 'base64').toString('utf8');
//         id = JSON.parse(filename);
//     }
//     catch (e) {}
    
//     return id;
// }

// console.log(encode(''));
// console.log(encode(null));
// console.log(encode(undefined));
// console.log(encode(NaN));
// console.log(encode({}));
// console.log(encode([]));
// console.log(encode('test'));

// console.log(decode('_IiI_e'));
// console.log(decode('_InRlc3Qi'));
// console.log(decode(''));
// console.log(decode({}));

// const path = require('path');
// const fs = require('fs');
// const fsp = fs.promises;

// fsp.writeFile(path.join(__dirname, 'binh-test', 'inner', 'file1'), JSON.stringify({data: 123}), { encoding: 'utf8', flag: 'w' }).then(function() {
//     console.log('written');
// });

// const assert = require('assert');

// try {
//     var abc = assert.deepStrictEqual({ a: 1 }, { a: 1 });
//     console.log('abc', abc);
// } catch (error) {
//     console.log('not equal 01');
// }

// try {
//     assert.deepStrictEqual({ a: 1 }, { a: '1' });
// } catch (error) {
//     console.log('not equal 002');
// }


var cache = {}, id = 0, mock = {
    next: null,
    prev: null,
    user_id: 'blablablablabl',
    trust: 12345678901234,
    trust2: 12345678901234,
    trust3: 12345678901234,
    trust5: 12345678901234,
    trust6: 12345678901234,
    attributes: {
        role: 'member',
        permit: 3,
        hash: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail2: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail4: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail5: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail6: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail7: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail8: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail9: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail10: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
        mail11: "qwyugeakhvdasadsasdqwafacsxdasdqw=",
    }
};

for (var i = 0; i < 10000; i++) {
    cache[id++] = {
        next: mock,
        prev: mock,
        data: Object.assign({}, mock)
    };
    cache.id = id;
}

setInterval(function() {
    console.log('total', cache.id );
}, 3000);

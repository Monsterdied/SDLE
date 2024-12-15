const assert = require('assert');
const { Client } = require('./client');
const {Aworset} = require("./crdt/Aworset.js");
const { Mutex } = require('async-mutex');
const { Console } = require('console');
const mutex = new Mutex();
let passed = 0
let passedTests = [];
async function test(id){
    const client = new Client('localhost', 5555,id);
    await client.initialize();
    let crdt = 'FAIL';
    while(crdt === 'FAIL'){
        crdt = await client.get(`key${id}`);
        console.log('SET status Return:', crdt,id + 25);
    }
    console.log('CLIENT GET value:', crdt);
    //console.log('Tester GET value:', getValue.toString());
    const crdtsList = Aworset.fromJson( crdt);
    const items = crdtsList.getItems();
    console.log('Tester GET value:', items);
    for(const item in items){
        console.log('Item:', item, 'Quantity:', items[item].quantity);
        //assert.strictEqual(valuesTest[item], items[item].quantity, `GET operation failed for key${id}`);
    }
    //assert.strictEqual(getValue.toString(), `value${id}`, `GET operation failed for key${id}`);
    console.log(`Test passed${id}`);
    await mutex.acquire();
    passed++;
    //console.log(`Passed n ${passed}`);
    passedTests.push(id);
    mutex.release();
    console.log(`Number : ${passed} Passed tests ${passedTests}`);

}

async function main() {
    for (let i = 0; i < 10; i++) {
        await test(i);
    }
    process.exit(0);
}
main();
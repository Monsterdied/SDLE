const assert = require('assert');
const { Client } = require('./client');
const {Aworset} = require("./crdt/Aworset.js");
const { Mutex } = require('async-mutex');
const mutex = new Mutex();
let passed = 0
let passedTests = [];
async function test(id){
    const client = new Client('localhost', 5555,id);
    await client.initialize();
    //console.log('Client started');

    // Perform SET operation
    let setStatus = 'FAIL';
    console.log('CLIENT SET key:', `key${id}`);
    let shoppingList = new Aworset('replica1', 'Shopping List');
    const valuesTest = {apple: Math.floor( Math.random()*10) + 1, banana: Math.floor(Math.random()*5) + 1, orange: 3};
    shoppingList.addItem('apple',valuesTest.apple);
    shoppingList.addItem('banana',valuesTest.banana);
    while(setStatus !== 'OK') {

        setStatus = await client.set(`key${id}`, shoppingList.toJson());
        console.log('CLIENT SET status Return:', setStatus);   
        console.log('CLIENT SET status Return:', setStatus); 
        //await new Promise(resolve => setTimeout(resolve, 3000));
    }
    shoppingList.addItem('orange',valuesTest.orange);
    setStatus = 'FAIL';
    while(setStatus !== 'OK') {

        setStatus = await client.set(`key${id}`, shoppingList.toJson());
        console.log('CLIENT SET status Return:', setStatus);   
        console.log('CLIENT SET status Return:', setStatus); 
        //await new Promise(resolve => setTimeout(resolve, 3000));
    }
    //console.log('tester SET status:', setStatus);
    assert.strictEqual(setStatus, 'OK', `SET operation failed for key${id}`);


    // Perform GET operation
    console.log('CLIENT GET key:', `key${id}`);
    const crdt = await client.get(`key${id}`);
    console.log('CLIENT GET value:', crdt);
    //console.log('Tester GET value:', getValue.toString());
    const crdtsList = Aworset.fromJson( crdt);
    const items = crdtsList.getItems();
    console.log('Tester GET value:', items);
    for(const item in items){
        console.log('Item:', item, 'Quantity:', items[item].quantity);
        console.log('Item:', item, 'Quantity:', valuesTest[item]);
        assert.strictEqual(valuesTest[item], items[item].quantity, `GET operation failed for key${id}`);
    }
    for(const item in valuesTest){
        console.log('Item:', item, 'Quantity:', valuesTest[item]);
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
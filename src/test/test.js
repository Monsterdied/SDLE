const zmq = require('zeromq');
const { Coordinator } = require('./coordinator');
const { StorageNode } = require('./storage_node');
const { Client } = require('./client');
const { ClientWeb } = require('./clientwithweb');
const ConsistentHash = require('./consistent_hash');
const assert = require('assert');
const { Console } = require('console');
const { threadId } = require('worker_threads');
let passed = 0
const passedTests = [];
async function main() {
    let coordinatorPort = 5555;
    let publishPort = 5556;

    let initialStorageNodePort = 5557;
    let numberOfNodes = 19;

    // Start Coordinator
    const coordinator = new Coordinator(coordinatorPort, publishPort);
    coordinator.initialize();
    console.log('Coordinator started');

    // Start Storage Node
    let debug = true
    for (let i = initialStorageNodePort; i < initialStorageNodePort + numberOfNodes*3; i=i+3) {
        const storageNode = new StorageNode(i, coordinatorPort, publishPort,debug);
        debug = false
        storageNode.initialize();
        console.log(`Storage Node ${i} started`);
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    // Give some time for nodes to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    for (let i = 0; i < 2; i++) {
        test(i);
    }
    // Start Client
    console.log('CLIENT OK');

}
async function test(id){
    const client = new Client('localhost', 5555,id);
    await client.initialize();
    //console.log('Client started');

    // Perform SET operation
    let setStatus = 'FAIL';
    console.log('CLIENT SET key:', `key${id}`);
    while(setStatus !== 'OK') {
        setStatus = await client.set(`key${id}`, `value${id}`);
        console.log('CLIENT SET status Return:', setStatus);   
        console.log('CLIENT SET status Return:', setStatus); 
        //await new Promise(resolve => setTimeout(resolve, 3000));
    }
    //console.log('tester SET status:', setStatus);
    assert.strictEqual(setStatus, 'OK', `SET operation failed for key${id}`);


    // Perform GET operation
    console.log('CLIENT GET key:', `key${id}`);
    const getValue = await client.get(`key${id}`);
    console.log('CLIENT GET value:', getValue);
    //console.log('Tester GET value:', getValue.toString());
    assert.strictEqual(getValue.toString(), `value${id}`, `GET operation failed for key${id}`);
    console.log(`Test passed${id}`);
    passed++;
    //console.log(`Passed n ${passed}`);
    passedTests.push(id);
    console.log(`Number : ${passed} Passed tests ${passedTests}`);

}

//test hash table
function testConsistentHash(){
    const consistent_hash = new ConsistentHash();
    for (let i = 5569; i > 5562; i--) {
        consistent_hash.addNode(i);
    }
    consistent_hash.removeNode(5563);
    for (let i = 0; i < 1000; i++) {
        console.log(consistent_hash.getNode(`key${i}`));
    }
}

async function tomatinho(){
    let coordinatorPort = 5555;
    let publishPort = 5556;

    let initialStorageNodePort = 5557;
    let numberOfNodes = 12;

    // Start Coordinator
    const coordinator = new Coordinator(coordinatorPort, publishPort);
    coordinator.initialize();
    console.log('Coordinator started');

    // Start Storage Node
    for (let i = initialStorageNodePort; i < initialStorageNodePort + numberOfNodes*3; i=i+3) {
        const storageNode = new StorageNode(i, coordinatorPort, publishPort);
        storageNode.initialize();
        console.log(`Storage Node ${i} started`);
    }
    // Give some time for nodes to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    for (let i = 0; i < 3; i++) {
        test(i);
        await  new Promise((resolve) => {
            setTimeout(resolve, 200);
          });
    }
    // Start Client
}
main()
//tomatinho()
//const clientWeb = new ClientWeb('localhost', 5555, 5569);
//clientWeb.initialize();

//main()


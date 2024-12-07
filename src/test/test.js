const zmq = require('zeromq');
const { Coordinator } = require('./coordinator');
const { StorageNode } = require('./storage_node');
const { Client } = require('./client');
const { ClientWeb } = require('./clientwithweb');
const ConsistentHash = require('./consistent_hash');
const assert = require('assert');

async function main() {
    let coordinatorPort = 5555;
    let publishPort = 5556;

    let initialStorageNodePort = 5557;
    let numberOfNodes = 12;

    // Start Coordinator
    const coordinator = new Coordinator(coordinatorPort, publishPort);
    coordinator.initialize();
    console.log('Coordinator started');

    // Start Storage Node
    for (let i = initialStorageNodePort; i < initialStorageNodePort + numberOfNodes; i++) {
        const storageNode = new StorageNode(i, coordinatorPort, publishPort);
        storageNode.initialize();
        console.log(`Storage Node ${i} started`);
    }
    // Give some time for nodes to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    for (let i = 0; i < 30; i++) {
        test(i);
    }
    // Start Client

}
async function test(id){
    const client = new Client('localhost', 5555,id);
    await client.initialize();
    console.log('Client started');

    // Perform SET operation
    const setStatus = await client.set(`key${id}`, `value${id}`);
    console.log('tester SET status:', setStatus);
    assert.strictEqual(setStatus, 'OK', `SET operation failed for key${id}`);


    // Perform GET operation
    const getValue = await client.get(`key${id}`);
    console.log('Tester GET value:', getValue.toString());
    assert.strictEqual(getValue.toString(), `value${id}`, `GET operation failed for key${id}`);

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

//const clientWeb = new ClientWeb('localhost', 5555, 5569);
//clientWeb.initialize();

//main()


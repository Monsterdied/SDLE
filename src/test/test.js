const zmq = require('zeromq');
const { Coordinator } = require('./coordinator');
const { StorageNode } = require('./storage_node');
const { Client } = require('./client');
const ConsistentHash = require('./consistent_hash');
async function main() {
    // Start Coordinator
    const coordinator = new Coordinator(5555, 5556);
    coordinator.initialize();
    console.log('Coordinator started');

    // Start Storage Node
    for (let i = 5557; i < 5570; i++) {
        const storageNode = new StorageNode(i, 5555, 5556);
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

    // Perform GET operation
    const getValue = await client.get(`key${id}`);
    console.log('Tester GET value:', getValue.toString());
}

//main().catch(err => console.error(err));
//test hash table
const consistent_hash = new ConsistentHash();
for (let i = 5569; i > 5562; i--) {
    consistent_hash.addNode(i);
}
consistent_hash.removeNode(5563);
for (let i = 0; i < 1000; i++) {
    console.log(consistent_hash.getNode(`key${i}`));
}

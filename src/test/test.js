const zmq = require('zeromq');
const { Coordinator } = require('./coordinator');
const { StorageNode } = require('./storage_node');
const { Client } = require('./client');

async function main() {
    // Start Coordinator
    const coordinator = new Coordinator(5555, 5556);
    coordinator.initialize();
    console.log('Coordinator started');

    // Start Storage Node
    const storageNode = new StorageNode(5557, 5555, 5556);
    storageNode.initialize();
    console.log('Storage Node started');

    // Give some time for nodes to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start Client
    const client = new Client('localhost', 5555);
    await client.initialize();
    console.log('Client started');

    // Perform SET operation
    const setStatus = await client.set('key1', 'value1');
    console.log('tester SET status:', setStatus);
/*
    // Perform GET operation
    const getValue = await client.get('key1');
    console.log('Tester GET value:', getValue);*/
}

main().catch(err => console.error(err));
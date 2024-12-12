const zmq = require('zeromq');
const { Coordinator } = require('../coordinator');
const { StorageNode } = require('../storage_node');
const { Client } = require('../client');
const { ClientWeb } = require('../clientwithweb');
const ConsistentHash = require('../consistent_hash');
const assert = require('assert');
const { Console } = require('console');
const { threadId } = require('worker_threads');
const { Aworset } = require("../crdt/Aworset.js");


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
}

main();
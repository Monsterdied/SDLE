const { StorageNode } = require('./storage_node');
async function testCordinator() {
    let coordinatorPort = 5555;
    let publishPort = 5556;

    let initialStorageNodePort = 5557;
    let numberOfNodes = 5;

    // Start Storage Node
    let debug = true
    for (let i = initialStorageNodePort; i < initialStorageNodePort + numberOfNodes*3; i=i+3) {
        const storageNode = new StorageNode(i, coordinatorPort, publishPort,debug);
        debug = false
        await storageNode.initialize();
        console.log(`Storage Node ${i} started`);
        await new Promise(resolve => setTimeout(resolve, 200));
    }

}
testCordinator();
const { StorageNode } = require('./storage_node');
async function testCordinator() {
    let coordinatorPort = 5555;
    let publishPort = 5556;


    // Start Storage Node
        const storageNode = new StorageNode(6000, coordinatorPort, publishPort);
        debug = false
        await storageNode.initialize();
        await new Promise(resolve => setTimeout(resolve, 200));

}
testCordinator();
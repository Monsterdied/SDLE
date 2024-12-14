const zmq = require('zeromq');
const { Coordinator } = require('./coordinator');
async function main() {
    let coordinatorPort = 5555;
    let publishPort = 5556;
    const coordinator = new Coordinator(coordinatorPort, publishPort);
    await coordinator.initialize();
    console.log('Coordinator started');
    }
main();
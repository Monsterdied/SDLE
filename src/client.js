// client.js
const zmq = require('zeromq');

async function run() {
    const sock = new zmq.Request();
    sock.connect('tcp://localhost:7000');
    console.log('Client connected to port 7000');

    while (true) {
        await sock.send('Hello');
        console.log('Sent: Hello');

        const [result] = await sock.receive();
        console.log('Received:', result.toString());
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

run();
// client.js
const zmq = require('zeromq');

async function run() {
    const sock = new zmq.Request();
    sock.connect('tcp://localhost:5555');
    console.log('Client connected to port 5555');

    for (let i = 0; i < 10; i++) {
        await sock.send(`${i}:Hello`);
        console.log(`Sent: ${i}:Hello`);

        const [result] = await sock.receive();
        console.log('Received:', result.toString());
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

run();
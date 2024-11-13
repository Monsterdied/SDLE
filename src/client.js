const zmq = require('zeromq');

async function run() {
    const sock = new zmq.Request();

    await sock.connect('tcp://localhost:7000');
    console.log('Client connected to port 7000');

    await sock.send('Hello');
    const [result] = await sock.receive();
    console.log('Received:', result.toString());
}

run();
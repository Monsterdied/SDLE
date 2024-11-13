const zmq = require('zeromq');

async function run(port) {
    const sock = new zmq.Reply();

    await sock.bind(`tcp://*:${port}`);
    console.log(`Server bound to port ${port}`);

    for await (const [msg] of sock) {
        console.log('Received:', msg.toString());
        await sock.send('World');
    }
}

moduler.exports = {run};
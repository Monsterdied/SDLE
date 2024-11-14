// server.js
const zmq = require('zeromq');

async function run(port) {
    const sock = new zmq.Reply();

    await sock.bind(`tcp://*:${port}`);
    console.log(`Server bound to port ${port}`);

    for await (const [msg] of sock) {
        console.log(`Received on port ${port}:`, msg.toString());
        await sock.send(`World from ${port}`);
        console.log(`Sent from port ${port}: World`);
    }
}

module.exports = { run };
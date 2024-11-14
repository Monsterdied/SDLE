// server.js
const zmq = require('zeromq');

async function run(port) {
    const sock = new zmq.Reply();

    try {
        await sock.connect(`tcp://localhost:6000`);
        console.log(`Server ${process.pid} connected to proxy on port 6000`);

        for await (const [msg] of sock) {
            console.log(`Worker ${process.pid} received:`, msg.toString());
            await sock.send(`World from worker ${process.pid} on port ${port}`);
            console.log(`Worker ${process.pid} sent response`);
        }
    } catch (err) {
        console.error(`Worker ${process.pid} error:`, err);
    }
}

module.exports = { run };
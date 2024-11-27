// server.js
const zmq = require('zeromq');

async function run(port) {
    const sock = new zmq.Dealer();

    try {
        await sock.connect(`tcp://localhost:6000`);
        console.log(`Server ${process.pid} connected to proxy on port 6000`);
        sock.identity = `${port}`;

        worker.on('message', (...frames) => {
            const clientAddress = frames[0];
            const message = frames[1].toString();
            
            console.log(`${workerId} processing: ${message}`);
            
            // Simulate work processing
            const result = `Processed by ${port}: ${message}`;
            
            // Send response back through proxy
            worker.send([clientAddress, result]);
          });
    } catch (err) {
        console.error(`Worker ${process.pid} error:`, err);
    }
}

module.exports = { run };
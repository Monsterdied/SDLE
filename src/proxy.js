// proxy.js
const zmq = require('zeromq');

async function run() {
    // Create frontend and backend sockets
    const frontend = new zmq.Router();
    const backend = new zmq.Dealer();

    await frontend.bind('tcp://*:7000');
    console.log('Frontend bound to port 7000');

    // Connect backend to all server instances
    const serverPorts = [5000, 5001, 5002, 5003];
    for (const port of serverPorts) {
        await backend.connect(`tcp://localhost:${port}`);
        console.log(`Backend connected to server on port ${port}`);
    }

    async function forwardMessages() {
        for await (const [routingInfo, ...parts] of frontend) {
            console.log('Frontend received:', parts.map(p => p.toString()));
            await backend.send([routingInfo, ...parts]);
        }       
    }

    async function backwardMessages() {
        for await (const parts of backend) {
            console.log('Backend received:', parts.map(p => p.toString()));
            await frontend.send(parts);
        }
    }

    Promise.all([
        forwardMessages(),
        backwardMessages()
    ]);

    // Handle cleanup
    process.on('SIGINT', () => {
        frontend.close();
        backend.close();
        process.exit();
    });
}

// Start servers
const serversPorts = [5000, 5001, 5002, 5003];
for (const port of serversPorts) {
    require('./server').run(port);
    console.log(`Server started on port ${port}`);
}

run();
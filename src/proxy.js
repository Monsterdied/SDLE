const zmq = require('zeromq');
const server = require('./server.js');

const context = new zmq.Context()

async function run() {

    const backend = new zmq.Router(context);
    const frontend = new zmq.Dealer(context);

    await backend.bind('tcp://*:6000');
    console.log('Backend bound to port 6000');

    await frontend.bind('tcp://*:7000');
    console.log('Frontend bound to port 7000');

    const proxy = new zmq.Proxy(frontend, backend);

    proxy.run();
    console.log('Proxy running');

}

const serversPorts = [5000,50001,5002,5003]
for (const port of serversPorts) {
    server.run(port);
    console.log(`Server running on port ${port}`);
}


run(); 


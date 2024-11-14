// proxy.js
const zmq = require("zeromq");
const cluster = require("cluster");

// Configuration for server ports
const serverPorts = [5000, 5001, 5002, 5003];  

async function run() {
    const context = new zmq.Context();
    const frontend = new zmq.Router(context);
    const backend = new zmq.Dealer(context);

    await frontend.bind('tcp://*:7000');
    console.log('Frontend bound to port 7000');

    await backend.bind('tcp://*:6000');
    console.log('Backend bound to port 6000');

    const proxy = new zmq.Proxy(frontend, backend);

    // Cleanup when the process is terminated
    process.on('SIGINT', () => {
        frontend.close();
        backend.close();
        proxy.terminate();
        process.exit();
    });

    proxy.run();
    console.log('Proxy running...');
}

if (cluster.isMaster) {
    console.log(`Master process ${process.pid} is running`);

    for (const port of serverPorts) {
        const worker = cluster.fork({
            "PORT": port
        });
        worker.port = port;
        console.log(`Started worker for port ${port}`);
    }

    cluster.on('exit', async (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} on port ${worker.port} died`);
        
        // Wait a bit before restarting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Restart the worker
        const newWorker = cluster.fork({
            "PORT": worker.port
        });
        newWorker.port = worker.port;
        console.log(`Started new worker for port ${worker.port}`);
    });

    run();
} else {
    // Worker processes run the server
    console.log(`Worker ${process.pid} starting on port ${process.env.PORT}`);
    require('./server2').run(process.env.PORT);
}
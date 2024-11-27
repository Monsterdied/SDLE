

const zmq = require("zeromq");
const crypto = require('crypto');

// Proxy router that distributes work to workers
async function startProxy() {
  const context = new zmq.Context();
  const frontend = new zmq.Router(context);
  const backend = new zmq.Dealer(context);

  await frontend.bind('tcp://*:5555');  // Client-facing endpoint
  await backend.bind('tcp://*:5556');   // Worker-facing endpoint

    // Custom load balancing with worker selection strategy
    while (true){
        const [clientId,request] = await frontend.receive();
        const workerId = selectWorker(clientId);
        const routedFrames = [workerId, request];
        backend.send(routedFrames);
    }
}

// Worker selection strategy
function selectWorker(messageContent) {
  const workers = ['worker1', 'worker2', 'worker3'];
  const hash = crypto.createHash('md5').update(messageContent).digest('hex');
  const workerIndex = parseInt(hash, 16) % workers.length;
  return workers[workerIndex];
}

// Dealer worker implementation
async function startWorker(workerId) {
  const worker = new zmq.Dealer();
  worker.identity = workerId;
  worker.connect('tcp://localhost:5556');
    while (true){
        const [clientId,request] = await worker.receive();
        worker.send([clientId,`Processed by ${workerId}: ${request}`]);
        const clientAddress = clientId;
        const message = request.toString();
        
        console.log(`${workerId} processing: ${message}`);
        
        // Simulate work processing
        const result = `Processed by ${workerId}: ${message}`;
        
        // Send response back through proxy
        worker.send([clientAddress, result]);
    }
}

// Start proxy and workers

Promise.all([
    startProxy(),
    startWorker('worker1'),
    startWorker('worker2'),
    startWorker('worker3'),
  ]);

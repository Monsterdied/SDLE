const zmq = require('zeromq');


// ============ Storage Node ============
class StorageNode {
    constructor(nodeId,coordinatorPort, publishPort) {
        this.nodePort = nodeId;
        this.dealer = new zmq.Dealer();
        this.subscriber = new zmq.Subscriber();
        this.storage = new Map();
        //this.coordinatorAddress = coordinatorAddress;
        this.coordinatorPort = coordinatorPort;
        this.publishPort = publishPort;
    }

    async initialize() {
        // Connect to coordinator
        await this.dealer.bind(`tcp://localhost:${this.nodePort}`);
        await this.dealer.connect(`tcp://localhost:${this.coordinatorPort}`);
        await this.subscriber.connect(`tcp://localhost:${this.publishPort}`);
        
        // Subscribe to topology updates
        this.subscriber.subscribe('TOPOLOGY_UPDATE');
        // Register with coordinator
        await this.dealer.send(['REGISTER', `${this.nodePort}`]);
        await Promise.all([
            this.handleTopologyUpdates(),
            this.receivePackets()
        ]);
        // Start heartbeat
        this.startHeartbeat();
        

    }
    async handleTopologyUpdates() {
        // Handle topology updates
        while (true) {
            const [topic, message] = await this.subscriber.receive();
            if (topic.toString() === 'TOPOLOGY_UPDATE') {
                this.handleTopologyUpdate(JSON.parse(message.toString()));
            }
        }
    }
    async receivePackets() {
        while (true) {
            console.log('Waiting for packets...');
            const [identity,type,...packet] = await this.dealer.receive();// TODO probably expand this to make paralel requests
            // Handle the received packet
            console.log(`NODE Received packet: ${packet}`);
            switch (type.toString()) {
                case 'GET':
                    console.log('Received heartbeat');
                    console.log(packet);
                    this.dealer.send([identity,'GET_RESPONSE', 'OK']);
                    break;
                case 'SET':
                    console.log('SET request received');
                    console.log(packet);
                    this.dealer.send([identity,'SET_RESPONSE', 'OK']);
                    break;
            }
        }
    }

    startHeartbeat() {
        setInterval(async () => {
            try {
                await this.dealer.send(['HEARTBEAT']);
            } catch (err) {
                console.error('Failed to send heartbeat:', err);
            }
        }, 5000);
    }

    handleTopologyUpdate(nodes) {
        console.log(`Node ${this.nodePort} received topology update:`, nodes);
        // Implement data rebalancing logic here
    }
}
module.exports = { StorageNode };

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
        this.storage = new Map();
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
        this.startHeartbeat();
        this.handleTopologyUpdates();
        this.receivePackets();
        // Start heartbeat
        

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
            const [type,token,...packet] = await this.dealer.receive();// TODO probably expand this to make paralel requests
            // Handle the received packet
            console.log(`NODE Received packet: ${packet}`);
            switch (type.toString()) {
                case 'GET':
                    console.log('Received heartbeat');
                    console.log(packet);
                    if (this.storage.has(packet[0].toString())) {
                        this.dealer.send(['GET_RESPONSE',token, this.storage.get(packet[0].toString())]);
                    }else{
                        this.dealer.send(['GET_RESPONSE',token, 'NOT_FOUND']);
                    }
                    break;
                case 'SET':
                    console.log('SET request received');
                    console.log(packet.toString());
                    this.storage.set(packet[0].toString(), packet[1].toString());
                    this.dealer.send(['SET_RESPONSE',token, 'OK']);
                    break;
            }
        }
    }

    startHeartbeat() {
        setInterval(async () => {
            try {
                console.log(`Sending heartbeat node ${this.nodePort}`);
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

// Required dependencies
const zmq = require('zeromq');
const crypto = require('crypto');

class ConsistentHash {
    constructor(replicas = 100) {
        this.replicas = replicas;
        this.ring = new Map();
        this.nodes = new Set();
    }

    addNode(node) {
        this.nodes.add(node);
        // Add virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.set(hash, node);
        }
    }

    removeNode(node) {
        this.nodes.delete(node);
        // Remove virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.delete(hash);
        }
    }

    getNode(key) {
        if (this.ring.size === 0) return null;

        const hash = this.getHash(key);
        const sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
        
        // Find the first hash >= our key's hash
        for (const h of sortedHashes) {
            if (h >= hash) return this.ring.get(h);
        }
        
        // Wrap around to first node if we're past the end
        return this.ring.get(sortedHashes[0]);
    }

    getHash(key) {
        return crypto.createHash('md5').update(key).digest('hex');
    }
}

// ============ Coordinator Node ============
class Coordinator {
    constructor(coordinatorPort, publishPort) {
        this.consistentHash = new ConsistentHash();
        this.router = new zmq.Router();
        this.publisher = new zmq.Publisher();
        this.coordinatorPort = coordinatorPort;
        this.publishPort = publishPort;
        this.nodeHeartbeats = new Map();
    }

    async initialize() {
        await this.router.bind(`tcp://*:${this.coordinatorPort}`);
        await this.publisher.bind(`tcp://*:${this.publishPort}`);
        
        // Start heartbeat monitor
        this.monitorHeartbeats();
        
        while (true) {
            const [identity, type, ...rest] = await this.router.receive();
            
            switch (type.toString()) {
                case 'REGISTER':
                    const [nodeAddress] = rest;
                    this.registerNode(identity, nodeAddress.toString());
                    break;
                    
                case 'HEARTBEAT':
                    console.log('Received heartbeat from', identity.toString());
                    this.updateHeartbeat(identity.toString());
                    break;
                    
                case 'GET_NODE':
                    const [key] = rest;
                    const node = this.consistentHash.getNode(key.toString());
                    await this.router.send([identity, 'NODE', node]);
                    break;
            }
        }
    }

    registerNode(identity, address) {
        this.consistentHash.addNode(address);
        this.nodeHeartbeats.set(identity.toString(), Date.now());
        this.publisher.send(['TOPOLOGY_UPDATE', JSON.stringify(Array.from(this.consistentHash.nodes))]);
    }

    updateHeartbeat(identity) {
        this.nodeHeartbeats.set(identity, Date.now());
    }

    monitorHeartbeats() {
        setInterval(() => {
            const now = Date.now();
            for (const [identity, lastBeat] of this.nodeHeartbeats) {
                if (now - lastBeat > 10000) { // 10 seconds timeout
                    const node = Array.from(this.consistentHash.nodes)
                        .find(n => n.includes(identity));
                    if (node) {
                        this.consistentHash.removeNode(node);
                        this.nodeHeartbeats.delete(identity);
                        this.publisher.send(['TOPOLOGY_UPDATE', 
                            JSON.stringify(Array.from(this.consistentHash.nodes))]);
                    }
                }
            }
        }, 5000); // Check every 5 seconds
    }
}

// ============ Storage Node ============
class StorageNode {
    constructor(nodeId, coordinatorAddress, coordinatorPort, publishPort) {
        this.nodeId = nodeId;
        this.dealer = new zmq.Dealer();
        this.subscriber = new zmq.Subscriber();
        this.storage = new Map();
        this.coordinatorAddress = coordinatorAddress;
        this.coordinatorPort = coordinatorPort;
        this.publishPort = publishPort;
    }

    async initialize() {
        // Connect to coordinator
        await this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
        await this.subscriber.connect(`tcp://${this.coordinatorAddress}:${this.publishPort}`);
        
        // Subscribe to topology updates
        this.subscriber.subscribe('TOPOLOGY_UPDATE');
        
        // Register with coordinator
        await this.dealer.send(['REGISTER', `${this.nodeId}`]);
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Handle topology updates
        while (true) {
            const [topic, message] = await this.subscriber.receive();
            if (topic.toString() === 'TOPOLOGY_UPDATE') {
                this.handleTopologyUpdate(JSON.parse(message.toString()));
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
        console.log(`Node ${this.nodeId} received topology update:`, nodes);
        // Implement data rebalancing logic here
    }
}

// ============ Client ============
class Client {
    constructor(coordinatorAddress, coordinatorPort) {
        this.dealer = new zmq.Dealer();
        this.coordinatorAddress = coordinatorAddress;
        this.coordinatorPort = coordinatorPort;
        this.nodeConnections = new Map();
    }

    async initialize() {
        await this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
    }

    async getNodeForKey(key) {
        await this.dealer.send(['GET_NODE', key]);
        const [_, node] = await this.dealer.receive();
        console.log('Sent GET_NODE request',node);
        return node.toString();
    }

    async getConnection(nodeAddress) {
        if (!this.nodeConnections.has(nodeAddress)) {
            const dealer = new zmq.Dealer();
            console.log('Connecting to node', nodeAddress);
            await dealer.connect(`tcp://*:${nodeAddress}`);
            this.nodeConnections.set(nodeAddress, dealer);
        }
        return this.nodeConnections.get(nodeAddress);
    }

    async set(key, value) {
        const node = await this.getNodeForKey(key);
        const connection = await this.getConnection(node);
        await connection.send(['SET', key, value]);
        const [status] = await connection.receive();
        return status.toString();
    }

    async get(key) {
        const node = await this.getNodeForKey(key);
        const connection = await this.getConnection(node);
        await connection.send(['GET', key]);
        const [value] = await connection.receive();
        return value.toString();
    }
}

// ============ Example Usage ============
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  } 
async function runExample() {
    // Start coordinator
    console.log('Starting coordinator...');
    const coordinator = new Coordinator(5555, 5556);
    coordinator.initialize();
    await delay(2000);
    // Start multiple storage nodes
    const nodes = [];
    for (let i = 0; i < 3; i++) {
        console.log(`Starting storage node ${i}...`);
        const node = new StorageNode(
            `node${i}`,
            'localhost',
            5555,
            5556
        );
        nodes.push(node);
        node.initialize();
        await delay(500);
    }
    // Create client
    console.log('Creating client...');
    const client = new Client('localhost', 5555);
    await client.initialize();

    // Example operations
    console.log('Setting key1 to value1...');
    await client.set('key1', 'value1');
    console.log('geting key1...');
    const value = await client.get('key1');
    console.log('Retrieved value:', value);
}

module.exports = {
    ConsistentHash,
    Coordinator,
    StorageNode,
    Client
};
runExample()
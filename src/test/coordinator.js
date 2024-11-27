const zmq = require('zeromq');
const ConsistentHash = require('./consistent_hash');

// ============ Coordinator Node ============
class Coordinator {
    constructor(coordinatorPort, publishPort) {
        this.consistentHash = new ConsistentHash();
        this.router = new zmq.Router();
        this.routerRequest = new zmq.Router();
        this.publisher = new zmq.Publisher();
        this.coordinatorPort = coordinatorPort;
        this.publishPort = publishPort;
        this.nodeHeartbeats = new Map();
        this.node_id_to_identifiers = new Map();
    }

    async initialize() {
        await this.router.bind(`tcp://*:${this.coordinatorPort}`);
        await this.publisher.bind(`tcp://*:${this.publishPort}`);
        
        // Start heartbeat monitor
        this.monitorHeartbeats();
        
        while (true) {
            const [identity, type, ...rest] = await this.router.receive();
            this.handleRequests(identity, type, rest);
        }
    }
    async handleRequests(identity, type, rest) {
        console.log('Cordinator Received:', type.toString());
        switch (type.toString()) {
            case 'REGISTER':
                const [nodeAddress] = rest;
                console.log('Received register from', identity.toString());
                this.registerNode(identity, nodeAddress.toString());
                break;
            case 'HEARTBEAT':
                console.log('Received heartbeat from', identity.toString());
                this.updateHeartbeat(identity.toString());
                break;
            case 'GET_CLIENT':
                const [key] = rest;
                const portId = this.consistentHash.getNode(key.toString());
                const identity1 = this.node_id_to_identifiers.get(portId);
                console.log('CORDINATOR Response:', identity1.toString());
                const response = await this.router.send( [identity1,'GET', key]);
                await this.router.send([identity, 'RESPONSE', response]);
                break;
            //Client requests
            case 'SET_CLIENT':
                const [key1] = rest;
                const portId1 = this.consistentHash.getNode(key1.toString());
                const identity2 = this.node_id_to_identifiers.get(portId1);
                const response1 = await this.router.send( [identity2,'SET', key1]);
                console.log('CORDINATOR Response:', response1.toString());
                await this.router.send([identity, 'RESPONSE', response1]);
                break;
        }
    }
    registerNode(identity, address) {
        this.consistentHash.addNode(address);
        this.node_id_to_identifiers.set(address, identity);
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
module.exports = { Coordinator };



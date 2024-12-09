const zmq = require('zeromq');
const ConsistentHash = require('./consistent_hash');
const mutex = require('async-mutex');

// ============ Coordinator Node ============
class Coordinator {
    constructor(coordinatorPort, publishPort, nreplicas = 3) {
        this.nreplicas = nreplicas;
        this.consistentHash = new ConsistentHash(nreplicas);
        this.router = new zmq.Router();
        this.routerRequest = new zmq.Router();
        this.publisher = new zmq.Publisher();
        this.coordinatorPort = coordinatorPort;
        this.publishPort = publishPort;
        this.nodeHeartbeats = new Map();
        this.node_id_to_identifiers = new Map();
        this.tokens_to_request = new Map();
        this.register_lock = new mutex.Mutex();
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
                await this.registerNode(identity, nodeAddress.toString());
                break;
            case 'HEARTBEAT':
                console.log('Received heartbeat from', identity.toString());
                this.updateHeartbeat(identity.toString());
                break;
            //Client requests
            case 'GET_CLIENT':
                const [token,key] = rest;
                console.log('CORDINATOR Request:', key.toString(), token.toString());
                const portsIds = await this.consistentHash.getNode(key.toString());
                const identity1 = this.node_id_to_identifiers.get(portsIds[0]);
                console.log('CORDINATOR Response:', identity1.toString());
                await this.router.send( [identity1,'GET',token, key]);
                this.tokens_to_request.set(token.toString(), [Date.now(),identity,portsIds,'GET',key]);
                break;
            case 'PUT_CLIENT':
                const [token1,key1,crdt] = rest;
                console.log('CORDINATOR Request:', key1.toString(), token1.toString());
                const portsIds1 = await this.consistentHash.getNode(key1.toString());
                console.log('CORDINATOR Node chossed:', portsIds1.toString());
                const identity2 = this.node_id_to_identifiers.get(portsIds1[0]);
                const replicas_Needed_To_Akc = this.nreplicas;
                await this.router.send( [identity2,'PUT', token1,key1,crdt,JSON.stringify(portsIds1),replicas_Needed_To_Akc]);
                console.log('CORDINATOR Request:', identity2);
                this.tokens_to_request.set(token1.toString(), [Date.now(),identity,'PUT',key1,crdt,portsIds1,replicas_Needed_To_Akc]);
                //console.log('CORDINATOR Response:', response1.toString());
                break;
            //reply from node
            case 'GET_RESPONSE':
                const [token2, ...value] = rest;
                if(this.tokens_to_request.get(token2.toString())){
                    const [time,identity_Return,...rest] = this.tokens_to_request.get(token2.toString());
                    console.log('CORDINATOR GET_REPONSE:', identity_Return);
                    this.tokens_to_request.delete(token2.toString());
                    console.log('CORDINATOR GET_REPONSE:', value.toString());
                    await this.router.send([identity_Return, 'RESPONSE', value]);
                }else{
                    console.log('CORDINATOR GET_REPONSE TIMEOUT:', token2.toString());
                }
                break;
            case 'PUT_RESPONSE':
                const [token3, ...value3] = rest;
                console.log('CORDINATOR PUT_REPONSE:', token3.toString(),value3.toString());
                if(this.tokens_to_request.get(token3.toString())){
                    const [time,identity_Return3,...rest] = this.tokens_to_request.get(token3.toString());
                    this.tokens_to_request.delete(token3.toString());
                    console.log('CORDINATOR PUT_REPONSE:', value3.toString());
                    await this.router.send([identity_Return3, value3]);
                }else{
                    console.log('CORDINATOR GET_REPONSE TIMEOUT:', token2.toString());
                }
                break;
        }
    }
    async registerNode(identity, address) {
        this.register_lock.acquire();
        await this.consistentHash.addNode(address);
        this.node_id_to_identifiers.set(address, identity);
        this.nodeHeartbeats.set(identity.toString(), Date.now());
        this.publisher.send(['TOPOLOGY_UPDATE', JSON.stringify(Object.fromEntries(this.node_id_to_identifiers))]);
        this.register_lock.release();
    }

    updateHeartbeat(identity) {
        this.nodeHeartbeats.set(identity, Date.now());
    }

    monitorHeartbeats() {/*
        setInterval(async () => {
            const now = Date.now();
            for (const [identity, lastBeat] of this.nodeHeartbeats) {
                if (now - lastBeat > 10000) { // 10 seconds timeout
                    const node = Array.from(this.consistentHash.nodes)
                        .find(n => n.includes(identity));
                    if (node) {
                        await this.consistentHash.removeNode(node);
                        this.nodeHeartbeats.delete(identity);
                        this.publisher.send(['TOPOLOGY_UPDATE', 
                            JSON.stringify(Array.from(this.consistentHash.nodes))]);
                    }
                }
            }
        }, 5000); // Check every 5 seconds
        */
    }
    monitorRequests() {
        setInterval(() => {
            const now = Date.now();
            for (const [identity, [lastBeat,type,...rest]] of this.tokens_to_request) {
                if (now - lastBeat > 10000) { // 10 seconds timeout
                    //handle timeout request
                }
            }
        }, 5000); // Check every 5 seconds
    }
}
module.exports = { Coordinator };



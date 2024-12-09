const zmq = require('zeromq');

const { Mutex } = require('async-mutex');

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
        this.dealerSocket = new zmq.Dealer();
        this.routerSocket= new zmq.Router();
        this.nodesMap = new Map();
        this.tokenToCallback = new Map();
        this.routerMutex = new Mutex();
        this.storageMutex = new Mutex();
        this.dealerMutex = new Mutex();
        this.storageMutex = new Mutex();
        this.callBackMutex = new Mutex();
        this.test = 0;
    }

    async initialize() {
        // Connect to coordinator
        //await this.dealer.bind(`tcp://localhost:${this.nodePort}`);
        await this.routerSocket.bind(`tcp://localhost:${this.nodePort + 1}`);
        //await this.dealerSocket.bind(`tcp://localhost:${this.nodePort + 2}`);
        await this.dealer.connect(`tcp://localhost:${this.coordinatorPort}`);
        await this.subscriber.connect(`tcp://localhost:${this.publishPort}`);
        
        // Subscribe to topology updates
        this.subscriber.subscribe('TOPOLOGY_UPDATE');
        // Register with coordinator
        await this.dealer.send(['REGISTER', `${this.nodePort}`]);
        this.startHeartbeat();
        this.handleTopologyUpdates();
        this.receivePackets();
        this.listenToReplicasRouter();
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
                    await this.storageMutex.acquire();
                    if (this.storage.has(packet[0].toString())) {
                        this.dealer.send(['GET_RESPONSE',token, this.storage.get(packet[0].toString())]);
                        //console.log('GET request received',this.storage.get(packet[0].toString()));
                        //console.log('GET request received',this.storage);
                    }else{
                        this.dealer.send(['GET_RESPONSE',token, 'NOT_FOUND']);
                    }
                    this.storageMutex.release();
                    break;
                case 'SET':
                    console.log('SET request received');
                    const entity = false; // because we are calling back to the cordinator
                    await this.propagateWrite(entity,token, packet); 
                    break;
            }
        }
    }
    hasDuplicates(arr) {
        return arr.length !== new Set(arr).size;
    }
    async propagateWrite(entity,token,packet) {
        token = token.toString();
        const preferenceList = JSON.parse(packet[2].toString());
        await this.callBackMutex.acquire();
            this.tokenToCallback.set(token, [entity,preferenceList[0]]);
        this.callBackMutex.release();
        //console.log("NODEID:",this.nodePort,"CALL BACK:", this.tokenToCallback,"Packet :",packet.toString());
        let replicasAproved = Number(packet[3].toString());
        const key = packet[0].toString();
        const crdt = packet[1].toString();
        console.log("Preference list:",preferenceList,"nReplicas",replicasAproved,"CRDT",crdt,"Token",token,"Entity",entity,"nodePort",this.nodePort);
        await this.storageMutex.acquire();
            this.storage.set(key, crdt);
        this.storageMutex.release();
        replicasAproved--;
        if (replicasAproved > 0) {
            //console.log(packet[2].toString());
            //send request to a replica

            if(entity !== false){
                preferenceList.shift()
        }
                if(this.hasDuplicates(preferenceList)){
                    throw new Error('Duplicate nodes in preference list',preferenceList);
                }
                const request = new zmq.Request();
                request.connect(`tcp://localhost:${parseInt(preferenceList[1]) + 1}`);
                await request.send(['SET', token,key, crdt, JSON.stringify(preferenceList), replicasAproved]);
                this.listenToRequestResponse(request);
        }else{
            console.log('Starting backtracking',this.nodePort,key);
            this.backTrackWriteReplica(token,key);
        }   
    }
    async backTrackWriteReplica(token,key){
        //console.log('Backtracking to coordinator',this.nodePort);
        //console.log('Token:',this.tokenToCallback);
        await this.callBackMutex.acquire();
        const entity = this.tokenToCallback.get(token.toString())[0];
        this.callBackMutex.release();
        if(entity !== false ){
            //console.log(this.storage);
            await this.routerMutex.acquire();
                console.log('Backtracking to storage',key,this.nodePort,this.tokenToCallback.get(token.toString())[1]);
            const delimeter = "";
                await this.routerSocket.send([entity,delimeter,'SET_RESPONSE',token, 'OK',key.toString()]);
            this.routerMutex.release();
            //release();
        }else{
            //console.log('Backtracking to coordinator');
            await this.dealerMutex.acquire();
            await this.dealer.send(['SET_RESPONSE',token, 'OK']);
            this.dealerMutex.release();
        }
    }
    async listenToReplicasRouter() {
        while (true) {
            const [entity,filler,type,token,...packet] = await this.routerSocket.receive();
            console.log(`NODE Received packet Router: ${type}`);
            switch (type.toString()) {
                case 'SET':
                    console.log(`Received Set request in router ${this.nodePort}`);
                    this.propagateWrite(entity,token,packet);
                    break;
            }
        }
    }
    async listenToRequestResponse(request) {
        //console.log(`Waiting for packets Dealer... ${this.nodePort}`);
        console.log('Waiting for packets Request packet');
        const [type,token,...packet] = await request.receive();
        console.log(`NODE Received packet Request: ${packet}, ${this.nodePort}, $`);
        switch (type.toString()) {
            case 'SET_RESPONSE':
                //console.log(`Received Dealer response ${this.nodePort}`);
                this.backTrackWriteReplica(token,packet[1].toString());
                break;
        }
    }

    startHeartbeat() {
        /*setInterval(async () => {
            try {
                console.log(`Sending heartbeat node ${this.nodePort}`);
                await this.dealer.send(['HEARTBEAT']);
            } catch (err) {
                console.error('Failed to send heartbeat:', err);
            }
        }, 5000);*/
    }

    handleTopologyUpdate(nodes) {
        //console.log(`Node ${this.nodePort} received topology update:`);
        this.nodesMap.clear();
        for (const key in nodes) {
            //console.log(Buffer.from(nodes[key]).toString());
            this.nodesMap.set(key,Buffer.from(nodes[key]));
        }
        // Implement data rebalancing logic here
    }
}
module.exports = { StorageNode };

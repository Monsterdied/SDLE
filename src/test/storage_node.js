const zmq = require('zeromq');

const { Mutex } = require('async-mutex');
const ConsistentHash = require('./consistent_hash');
const { json } = require('express');

// ============ Storage Node ============
class StorageNode {
    constructor(nodeId,coordinatorPort, publishPort,debug = false) {
        this.nodePort = nodeId;
        this.dealer = new zmq.Dealer();
        this.subscriber = new zmq.Subscriber();
        this.storage = new Map();
        this.storageBorrowed = new Map();
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
        this.entityMutex = new Mutex();
        this.test = 0;
        this.noise = 0.5;
        this.nreplicas;
        this.consistentHash;
        this.debug = debug;
    }

    async initialize() {
        // Connect to coordinator
        //await this.dealer.bind(`tcp://localhost:${this.nodePort}`);
        this.routerSocket.receiveHighWaterMark = 0;
        await this.routerSocket.bind(`tcp://localhost:${this.nodePort + 1}`);
        //await this.dealerSocket.bind(`tcp://localhost:${this.nodePort + 2}`);
        await this.dealer.connect(`tcp://localhost:${this.coordinatorPort}`);
        await this.subscriber.connect(`tcp://localhost:${this.publishPort}`);
        
        // Subscribe to topology updates
        this.subscriber.subscribe('TOPOLOGY_UPDATE');
        // Register with coordinator
        await this.dealer.send(['REGISTER', `${this.nodePort}`]);
        this.handleTopologyUpdates();
        this.receivePackets();
        this.listenToReplicasRouter();
        // Start heartbeat
        

    }
    async getFromStorage(key){
        console.log('GET request received',JSON.stringify(Object.fromEntries(this.storage)));
        await this.storageMutex.acquire();
        let value = this.storage.get(key);
        console.log('GET request received Ok',key,value);
        if(value === undefined){
            //TODO THIS IS WRONG
            value = this.storageBorrowed.get(key);
        }
        this.storageMutex.release();
        if (value === undefined){
            return false;
        }
        return value;
    }
    //checks if it is responsible for the key, if it is adds it to the storage, if not returns the next node to send the request to
    async addToStorage(key,value,removeNodes){
        //convert virtual nodes to nodesIdS
        const vnodes = await this.consistentHash.getPreferrencedList(key,this.nreplicas);
        console.log('Vnodes:',this.nreplicas,vnodes,this.nodePort,'key',key,'value',value);
        for (const vnode of vnodes) {
            const node = vnode.split(':')[0];
            if(node === this.nodePort.toString()){
                await this.storageMutex.acquire();
                this.storage.set(key,value);
                this.storageMutex.release();
                return removeNodes;
            }
        }
        if(removeNodes.length === 0){
            console.log('No more nodes to send request to',key,vnodes,this.nodePort);
            throw new Error(`No more nodes to send request to ${key}`);
        }
        //This Node is Not responsible for this key
        console.log('Not responsible for this key',key,this.nodePort);
        await this.storageMutex.acquire();
        if(this.storageBorrowed.get(removeNodes[0]) === undefined){
            this.storageBorrowed.set(removeNodes[0],[(key,value)]);
        }else{
            const arr =this.storageBorrowed.get(removeNodes[0]);
            arr.push([key,value]);
            this.storageBorrowed.set(removeNodes[0],arr);
        }
            this.storageMutex.release();
            removeNodes.shift();
        return removeNodes;
    }
    // Start sending heartbeat messages to the coordinator
    async handleTopologyUpdates() {
        // Handle topology updates
        while (true) {
            const [topic, nreplicas,message] = await this.subscriber.receive();
            if (topic.toString() === 'TOPOLOGY_UPDATE') {
                this.handleTopologyUpdate(nreplicas,JSON.parse(message.toString()));
            }
        }
    }
    // Main loop to receive packets from the coordinator
    async receivePackets() {
        while (true) {
            console.log('Waiting for packets...');
            const [type,token,...packet] = await this.dealer.receive();// TODO probably expand this to make paralel requests
            // Handle the received packet
            console.log(`NODE Received packet: ${packet}`);
            switch (type.toString()) {
                case 'GET':
                        const value = await this.getFromStorage(packet[0].toString());
                        if(value === false){
                            console.log('GET request received',this.storage);
                            this.dealer.send(['GET_RESPONSE',token,'FAIL']);
                        }else{
                            this.dealer.send(['GET_RESPONSE',token,value ]);
                        }

                        //console.log('GET request received',this.storage.get(packet[0].toString()));
                        //console.log('GET request received',this.storage);
                    break;
                case 'PUT':
                    console.log('PUT request received');
                    const entity = false; // because we are calling back to the cordinator
                    this.propagateWrite(entity,token, packet); 
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
        let replicasAproved = Number(packet[3].toString());
        let replicasFailedToWrite = JSON.parse(packet[4].toString());
        await this.callBackMutex.acquire();
        this.tokenToCallback.set(token, [entity,preferenceList[0]]);




            ///warning change the write to write only when all replicas are written Or maby not disscuss with team
        this.callBackMutex.release();
        //console.log("NODEID:",this.nodePort,"CALL BACK:", this.tokenToCallback,"Packet :",packet.toString());
        const key = packet[0].toString();
        const crdt = packet[1].toString();
        replicasFailedToWrite = await this.addToStorage(key,crdt,replicasFailedToWrite);
        console.log("Preference list:",preferenceList,"nReplicas",replicasAproved,"CRDT",crdt,"Token",token,"Entity",entity,"nodePort",this.nodePort);
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
            await this.createRequestToReplica(token,key,crdt,preferenceList,replicasAproved,replicasFailedToWrite);
        }else{
            console.log('Starting backtracking',this.nodePort,key);
            this.backTrackWriteReplica(token,key,'OK');
        }   
    }
    async createRequestToReplica(token,key,crdt,preferenceList,replicasAproved,replicasFailedToWrite){
        let tries = 0;
        const resendTries = 0;
        let BoolResponse = false;
        while(preferenceList.length > 1){
            console.log('Sending request to replica',preferenceList[1],this.nodePort,token,key,crdt,preferenceList,replicasAproved);
            
            const request = new zmq.Request();
            request.receiveTimeout = 300*replicasAproved;//if there are more replicas to be aproved, wait longer
            const address = `tcp://localhost:${parseInt(preferenceList[1].split(':')[0]) + 1}`;
            request.receiveTimeout = 300*replicasAproved;
            request.connect(address);
            if(Math.random() >this.noise){
                console.log('Dropped packet');
                BoolResponse = false;
                await  new Promise((resolve) => {
                    setTimeout(resolve, 100);
                  });
            }else{
                await request.send(['PUT', token,key, crdt, JSON.stringify(preferenceList), replicasAproved, JSON.stringify(replicasFailedToWrite)]);
                console.log('Sent request to replica',preferenceList[1]);
                BoolResponse =await this.listenToRequestResponse(request,address);
            }
            if(BoolResponse===true){
                break;
            }else if(tries>=resendTries){
                console.log(`not working ${key}`,replicasAproved);
                replicasFailedToWrite.push(preferenceList[1]);
                preferenceList.shift();
                //request.close();
                tries = 0;
            }else{
                tries++;
            }
        }
        console.log('BoolResponse',BoolResponse);
        if(BoolResponse===false && replicasAproved !== 0){
            console.log(`Failed Write ${key}`,this.nodePort);
            this.backTrackWriteReplica(token,key,'FAIL');
            //TODO backtrack not commit write
        }
        

    }

    async listenToRequestResponse(request,address) {
        //console.log(`Waiting for packets Dealer... ${this.nodePort}`);
        console.log('Waiting for packets Request packet');
        try{
            const [type,token,...packet] = await request.receive();
        console.log(`NODE Received packet Request: ${packet}, ${this.nodePort}, $`);
        switch (type.toString()) {
            case 'PUT_RESPONSE':
                //console.log(`Received Dealer response ${this.nodePort}`);
                console.log('Received Dealer response',packet[0].toString());
                await this.backTrackWriteReplica(token,packet[1].toString(),packet[0].toString());//prob await here
                break;
            }
            console.log('Received Dealer response',packet[0].toString());
            return true;
        }catch(err){
            console.log('Failed to receive response:', err);
            request.disconnect(address);
            return false;
        }
    }
    async backTrackWriteReplica(token,key,value){
        //console.log('Backtracking to coordinator',this.nodePort);
        //console.log('Token:',this.tokenToCallback);
        await this.callBackMutex.acquire();
        if(this.tokenToCallback.get(token.toString()) === undefined){
            console.log('Token Already Respondend',token);
            return;
        }
        const entity = this.tokenToCallback.get(token.toString())[0];
        const debugPort = this.tokenToCallback.get(token.toString())[0]
        this.tokenToCallback.delete(token.toString());
        this.callBackMutex.release();
        if(entity !== false ){
            //console.log(this.storage);
            await this.routerMutex.acquire();
                console.log('Backtracking to storage',key,this.nodePort,debugPort);
            const delimeter = "";
                await this.routerSocket.send([entity,delimeter,'PUT_RESPONSE',token, value,key.toString()]);
            this.routerMutex.release();
            //release();
        }else{
            //console.log('Backtracking to coordinator');
            await this.dealerMutex.acquire();
            await this.dealer.send(['PUT_RESPONSE',token,value]);
            this.dealerMutex.release();
        }
    }
    async listenToReplicasRouter() {
        while (true) {
            const [entity,filler,type,token,...packet] = await this.routerSocket.receive();
            console.log(`NODE Received packet Router: ${type}`);
            switch (type.toString()) {
                case 'PUT':
                    console.log(`Received Set request in router ${this.nodePort}`);
                    this.propagateWrite(entity,token,packet);
                    break;
                /*case 'DISCARD':
                    console.log(`Received Discard request in router ${this.nodePort}, ${packet}`);
                    //TODO backtrack
                    break;*/
            }
        }
    }



    async handleTopologyUpdate(nreplicas,nodes) {
        //console.log(`Node ${this.nodePort} received topology update:`);
        this.nreplicas = Number(nreplicas.toString());
        if (!this.consistentHash){
            this.consistentHash = new ConsistentHash(nreplicas);
        }
        const setCopy = new Set(this.consistentHash.nodes);
        if(this.debug === true)
        console.log('Nodes:',this.consistentHash.nodes);
        for (const key in nodes) {
            const node = nodes[key];
            if(!this.consistentHash.nodes.has(node)){
                if(this.debug === true)
                    console.log('Adding node:',node,this.nodePort);
                await this.consistentHash.addNode(node.toString());
            }else{
                setCopy.delete(key);
            }
        }
        //dont worry about remove for now
        /*
        if(setCopy.size > 0){
            for (const key of setCopy) {
                //remove nodes
                this.consistentHash.removeNode(key);
            }
        }*/
        // Implement data rebalancing logic here
    }
}
module.exports = { StorageNode };

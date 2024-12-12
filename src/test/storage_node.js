const zmq = require('zeromq');

const { Mutex } = require('async-mutex');
const ConsistentHash = require('./consistent_hash');
const { json } = require('express');
const { Aworset } = require("./crdt/Aworset.js");
const fs = require('fs').promises;

// ============ Storage Node ============
class StorageNode {
    constructor(nodeId,coordinatorPort, publishPort,debug = false) {
        this.nodePort = nodeId;
        //sockets
        this.dealer = new zmq.Dealer();
        this.subscriber = new zmq.Subscriber();
        this.storageBorrowed = new Map();
        //this.coordinatorAddress = coordinatorAddress;
        this.coordinatorPort = coordinatorPort;
        this.publishPort = publishPort;
        this.dealerSocket = new zmq.Dealer();
        this.routerSocket= new zmq.Router();
        this.nodesMap = new Map();
        this.tokenToCallback = new Map();
        //create mutex for each type of operation
        this.routerMutex = new Mutex();
        this.storageMutex = new Mutex();
        this.dealerMutex = new Mutex();
        this.borrowedStorageMutex = new Mutex();
        this.callBackMutex = new Mutex();
        this.entityMutex = new Mutex();
        //test variables
        this.test = 0;
        this.noise = 1;
        this.nreplicas;
        this.consistentHash;
        this.debug = debug;
        this.storage;
    }

    async initialize() {
        // Connect to coordinator
        //set the high water mark to 0 to remove the high water mark
        this.routerSocket.receiveHighWaterMark = 0;
        // routerSocket is the socket that will receive messages from the replicas
        await this.routerSocket.bind(`tcp://localhost:${this.nodePort + 1}`);
        // dealer is the socket that will interact with the cordinator
        this.dealer.connect(`tcp://localhost:${this.coordinatorPort}`);
        this.subscriber.connect(`tcp://localhost:${this.publishPort}`);
        
        this.storage = await this.loadJsonToMap(`./storage/${this.nodePort}.json`);
        // Subscribe to topology updates
        this.subscriber.subscribe('TOPOLOGY_UPDATE');
        // Register with coordinator
        await this.dealer.send(['REGISTER', `${this.nodePort}`]);
        //Start the paralel operations
        // handle topology updates of nodes
        this.handleTopologyUpdates();
        // Start listening to packets from the coordinator
        this.receivePackets();
        //Start listening to packets in the Router
        this.listenToReplicasRouter();
        //Start monitoring borrowed storage and try to reach the replicas
        this.monitorBorrowedStorage();
        // Start heartbeat
        

    }
    // handle get requests Returns the value or if it doesnt have the value returns false
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
                //check if the key is already in the storage
                if(this.storage.get(key) !== undefined){
                    const crdtString = this.storage.get(key);
                    const firstCrdt = Aworset.fromJson(crdtString);
                    const secondCrdt = Aworset.fromJson(value);
                    //console.log('First:',firstCrdt.toJson());
                    //console.log('Second:',secondCrdt.toJson());
                    firstCrdt.merge(secondCrdt);
                    //console.log('Merged:',firstCrdt.toJson());
                    this.storage.set(key,value);
                    this.saveMapToJson(this.storage,`./storage/${this.nodePort}.json`);
                }else{
                    this.storage.set(key,value);
                }
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
        await this.borrowedStorageMutex.acquire();
        //Add to borrowed storage
        console.log('Adding to borrowed storage',removeNodes[0],key,value);
        if(this.storageBorrowed.get(removeNodes[0]) === undefined){
            const newlist = {};
            newlist[key] = value;
            this.storageBorrowed.set(removeNodes[0],newlist);
            console.log('TEST1', newlist);
        }else{
            const arr =this.storageBorrowed.get(removeNodes[0]);
            arr[key] = value;
            this.storageBorrowed.set(removeNodes[0],arr);
        }
        this.borrowedStorageMutex.release();
            removeNodes.shift();
        return removeNodes;
    }
    // Save the map to a JSON file
    async saveMapToJson(map, filename) {
        try {
          // Convert Map to an array of key-value pairs
          const serializedMap = Array.from(map.entries());
          
          // Write the serialized map to a JSON file
          await fs.writeFile(filename, JSON.stringify(serializedMap, null, 2));
          
          console.log(`Map saved to ${filename}`);
        } catch (error) {
          console.error('Error saving map to JSON:', error);
        }
      }
    // Load a JSON file into a Map
      async loadJsonToMap(filename) {
        try {
          // Read the JSON file
          const data = await fs.readFile(filename, 'utf8');
          
          // Parse the JSON and convert back to a Map
          const parsedArray = JSON.parse(data);
          const loadedMap = new Map(parsedArray);
          
          console.log(`Map loaded from ${filename}`);
          return loadedMap;
        } catch (error) {
          console.error('Error loading JSON to map:', error);
          return new Map();
        }
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
    /**
     * Handle a write request from the coordinator.
     * @param {boolean || buffer} entity - whether to send the response to the coordinator or not
     * @param {string} token - the token associated with the request
     * @param {Array} packet - the packet received from the coordinator
     * 
     * This method will handle the write request by writing the data to the storage,
     * and then sending a request to a replica to write the data.
     * If the write is successful, it will send a response back to the coordinator.
     * If the write fails, it will send a response back to the coordinator with the error.
     * 
     * The method will also handle the case where the node is not responsible for the key
     * by sending the request to the next node in the preference list.
     */
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
    /**
     * @description
     * This function sends a PUT request to a replica in the preference list.
     * It will keep sending the request until the replica responds with an OK,
     * or until the number of tries is reached, in which case it will backtrack
     * the write.
     * @param {string} token - The token of the request.
     * @param {string} key - The key of the request.
     * @param {string} crdt - The CRDT of the request.
     * @param {array} preferenceList - The preference list of nodes.
     * @param {number} replicasAproved - The number of replicas that have approved the write.
     * @param {array} replicasFailedToWrite - The list of replicas that have failed to write.
     * @return {Promise<void>} - A promise that resolves when the request is complete.
     */
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
    

    /**
     * Listen for a response from a replica after sending a write request
     * @param {zmq.Request} request - the request socket
     * @param {string} address - the address of the replica
     * @returns {Promise<boolean>} true if the response was received, false if an error occurred
     */
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
    /**
     * Handle a response from a replica after sending a write request
     * @param {string} token - the token associated with the request
     * @param {string} key - the key associated with the request
     * @param {string} value - the result of the request
     * @returns {Promise<void>}
     */
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
    /**
     * Listens for packets from other nodes and the coordinator
     * This is the main loop for receiving packets from the router
     * @returns {Promise<void>}
     */
    async listenToReplicasRouter() {
        while (true) {
            const [entity,filler,type,token,...packet] = await this.routerSocket.receive();
            console.log(`NODE Received packet Router: ${type}`);
            switch (type.toString()) {
                case 'PUT':
                    console.log(`Received Set request in router ${this.nodePort}`);
                    this.propagateWrite(entity,token,packet);
                    break;
                case 'BORROWED':
                    console.log(`Received Borrowed request in router ${this.nodePort}, ${packet}`);
                    const list = JSON.parse(token.toString());
                    this.routerMutex.acquire();
                    this.routerSocket.send([entity,'','UPDATE_RESPONSE',token,'OK']);
                    this.routerMutex.release();
                    //update the storage
                    for (const [key,value] of Object.entries(list)) {
                        console.log('Discarding:',key);
                        console.log('value:',value);
                        this.addToStorage(key,value,[]);
                    }
                    break;
            }
        }
    }

    monitorBorrowedStorage() {
        setInterval(async () => {
            const now = Date.now();
            //Probably timeout the temporary storage from now and then
            await this.borrowedStorageMutex.acquire();
            //so that we dont lock this variable for too long
            const tmpStorageBorrowed = new Map(this.storageBorrowed);

            this.borrowedStorageMutex.release();
            for (const [NodeId, list] of tmpStorageBorrowed) {
                console.log('Storage borrowed:',NodeId,list);
                const result = await this.sendBorrowedToReplica(NodeId.split(':')[0],list);
                if(result === true){
                    //update the real storage
                    await this.borrowedStorageMutex.acquire();
                    let newlist = this.storageBorrowed.get(NodeId);
                    if(newlist === undefined){
                        newlist = {};
                    }
                    console.log('Newlist:',Object.keys(list));
                    // to check if the list was updated while we were sending it
                    const setChecker = new Set(Object.keys(list));
                    newlist = Object.keys(newlist)
                    .filter(key => key > !setChecker.has(key))
                    .reduce((acc, key) => {
                        acc[key] = newlist[key];
                        return acc;
                    }, {});
                    //if the list was not updated while we were sending it
                    // we can remove it from the borrowed storage
                    console.log('Newlist:',Object.keys(newlist).length);
                    if(Object.keys(newlist).length !== 0){
                        this.storageBorrowed.set(NodeId,newlist);
                    }else{
                        this.storageBorrowed.delete(NodeId);
                    }
                    this.borrowedStorageMutex.release();
                }
            }
        }, 3000); // Check every 10 seconds
    }
/**
 * Sends a borrowed storage request to a specified replica.
 * @param {string} nodeid - The ID of the node to send the request to.
 * @param {Object} values - The values to be sent to the replica.
 * @returns {Promise<boolean>} - Returns true if the replica responds with 'OK', otherwise false if an error occurs or the response is not 'OK'.
 */
    async sendBorrowedToReplica(nodeid,values){
        const request = new zmq.Request();
        request.receiveTimeout = 300;
        request.sendTimeout = 300;
        const address = `tcp://localhost:${parseInt(nodeid) + 1}`;
        request.connect(address);
        try{
            await request.send(['BORROWED', JSON.stringify(values)]);
            console.log('Sent borrowed storage to replica',address);
            const [type,token,...packet] = await request.receive();
            console.log(`Received Dealer response ${this.nodePort}`);
            console.log('Received Dealer response',packet[0].toString());
            if(packet[0].toString() === 'OK'){
                return true;
            }else{
                return false;
            }
        }catch(err){
            request.close();
            console.log('Failed to receive response Borrowed:', err);
            return false;
        }
    }

/**
 * Updates the topology of the storage node by modifying the consistent hash ring.
 * 
 * @param {number} nreplicas - The number of replicas for each key in the system.
 * @param {Object} nodes - An object containing the nodes in the system.
 * 
 * This function updates the number of replicas and modifies the consistent hash
 * ring by adding new nodes that are not currently in the hash ring. Nodes that
 * are already present are retained and not added again. The function also resets
 * the number of replicas for the node. Additionally, there is a provision for
 * removing nodes, though it is not implemented currently. The function aims to
 * ensure that the consistent hash ring reflects the current topology of the system.
 */
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

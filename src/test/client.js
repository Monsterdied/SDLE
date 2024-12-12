const zmq = require('zeromq');
const { Mutex } = require('async-mutex');
const { spawn } = require('child_process');
class Client {
    constructor(coordinatorAddress, coordinatorPort,client_id) {
        this.dealer = new zmq.Dealer();
        this.coordinatorAddress = coordinatorAddress;
        this.coordinatorPort = coordinatorPort;
        this.nodeConnections = new Map();
        this.localStore = new Map();
        this.client_id =client_id;
        this.client_request_id = 0;
        this.mutex = new Mutex();
        this.initialize();
    }

    async initialize() {
        console.log(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
        this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
    }


    async get_token(){
        console.log('CLIENT GET TOKEN1');
        await this.mutex.acquire();
        console.log('CLIENT GET TOKEN2');
        this.client_request_id++;
        this.mutex.release();
        return `${this.client_id},${this.client_request_id}`;
    }
    async set(key, value) {
        const token = await this.get_token();
        await this.mutex.acquire();
        await this.dealer.send(['PUT_CLIENT', token,key, value]);
        //console.log('CLIENT SET key:', key);
        const [status] = await this.dealer.receive();
        this.mutex.release();
        //console.log('CLIENT SET status:', status.toString());
        return status.toString();
    }

    async get(key) {
        console.log('CLIENT GET key1:', key);
        const token = await this.get_token();
        console.log('CLIENT GET key2:', key);
        await this.mutex.acquire();
        await this.dealer.send(['GET_CLIENT',token, key]);
        console.log('CLIENT GET key3:', key);
        const [type,result] = await this.dealer.receive();
        this.mutex.release();
        return result.toString();
    }
}
module.exports = { Client };
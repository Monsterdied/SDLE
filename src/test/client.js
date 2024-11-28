const zmq = require('zeromq');
class Client {
    constructor(coordinatorAddress, coordinatorPort,client_id) {
        this.dealer = new zmq.Dealer();
        this.coordinatorAddress = coordinatorAddress;
        this.coordinatorPort = coordinatorPort;
        this.nodeConnections = new Map();
        this.localStore = new Map();
        this.client_id =client_id;
        this.client_request_id = 0;
    }

    async initialize() {
        await this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
    }

    get_token(){
        this.client_request_id++;
        return `${this.client_id},${this.client_request_id}`;
    }
    async set(key, value) {
        const token = this.get_token();
        await this.dealer.send(['SET_CLIENT', token,key, value]);
        const [status] = await this.dealer.receive();
        return status.toString();
    }

    async get(key) {
        const token = this.get_token();
        await this.dealer.send(['GET_CLIENT',token, key]);
        const [value] = await this.dealer.receive();
        return value.toString();
    }
}
module.exports = { Client };
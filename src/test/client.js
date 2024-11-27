const zmq = require('zeromq');
class Client {
    constructor(coordinatorAddress, coordinatorPort) {
        this.dealer = new zmq.Dealer();
        this.coordinatorAddress = coordinatorAddress;
        this.coordinatorPort = coordinatorPort;
        this.nodeConnections = new Map();
        this.localStore = new Map();
    }

    async initialize() {
        await this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
    }

    async set(key, value) {
        await this.dealer.send(['SET_CLIENT', key, value]);
        const [status] = await this.dealer.receive();
        return status.toString();
    }

    async get(key) {
        await this.dealer.send(['GET_CLIENT', key]);
        const [value] = await this.dealer.receive();
        return value.toString();
    }
}
module.exports = { Client };
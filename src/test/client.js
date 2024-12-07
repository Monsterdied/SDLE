const zmq = require('zeromq');
const mutex = require('async-mutex');
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
        this.mutex = new mutex.Mutex();
    }

    async initialize() {
        await this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
    }

    runServer() {
        const serverProcess = spawn('node', ['server.js'], {
            stdio: 'inherit', // Inherit stdio to see server output in the console
            cwd: __dirname // Set the current working directory to the directory of client.js
        });

        serverProcess.on('close', (code) => {
            console.log(`server.js process exited with code ${code}`);
        });
    }

    get_token(){
        this.mutex.acquire();
        this.client_request_id++;
        this.mutex.release();
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
        const [type,result] = await this.dealer.receive();
        return result.toString();
    }
}
module.exports = { Client };
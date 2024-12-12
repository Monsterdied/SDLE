const zmq = require('zeromq');
const mutex = require('async-mutex');
const { spawn } = require('child_process');
const { response } = require('express');
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
        this.receiveMutex = new mutex.Mutex();
        this.timeout = 10000;
    }

    async initialize() {
        await this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
    }

    async sendWithTimeout(request, timeout) {
        const responsePromise = this.receiveWithMutex();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout));
        
        try {
            await this.dealer.send(request);
            const response = await Promise.race([responsePromise, timeoutPromise]);
            return response;
        } catch (error) {
            console.log('Request timed out');
            return 'Server not responding';
        }
    }

    async receiveWithMutex() {
        await this.receiveMutex.acquire();
        try {
            const response = await this.dealer.receive();
            return response;
        } finally {
            this.receiveMutex.release();
        }
    }

    get_token(){
        this.mutex.acquire();
        this.client_request_id++;
        this.mutex.release();
        return `${this.client_id},${this.client_request_id}`;
    }
    
    async set(key, value) {
        const token = this.get_token();
        const response = await this.sendWithTimeout(['PUT_CLIENT', token, key, value], this.timeout);
        if (response === 'Server not responding') {
            return 'FAIL';
        }
        const [status] = response;
        return status.toString();
    }

    async get(key) {
        const token = this.get_token();
        const response = await this.sendWithTimeout(['GET_CLIENT', token, key], this.timeout);
        if (response === 'Server not responding') {
            return 'FAIL';
        }
        const [type, result] = response;
        return result.toString();
    }
}
module.exports = { Client };
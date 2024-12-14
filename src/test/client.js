const zmq = require('zeromq');
const { Mutex } = require('async-mutex');
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
        this.mutex = new Mutex();
        this.timeout = 10000;
    }

    async initialize() {
        console.log(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
        this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);
    }

    async sendWithTimeout(request, timeout) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout));
        
        try {
            await this.dealer.send(request);
            const responsePromise = this.dealer.receive();
            const response = await Promise.race([responsePromise, timeoutPromise]);
            return response;
        } catch (error) {
            console.log('Request timed out');
            return 'Server not responding';
        }
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
        console.log('sending set client', token);
        const response = await this.sendWithTimeout(['PUT_CLIENT', token, key, value], this.timeout);
        console.log('RESPONSE Received Set', response);
        if (response === 'Server not responding') {
            return 'FAIL';
        }
        const [status] = response;
        this.mutex.release();

        return status.toString();
    }

    async get(key) {
        const token = await this.get_token();
        const response = await this.sendWithTimeout(['GET_CLIENT', token, key], this.timeout);
        if (response === 'Server not responding') {
            return 'FAIL';
        }
        const [type, result] = response;
        this.mutex.release();
        return result.toString();
    }
}
module.exports = { Client };
const crypto = require('crypto');
const { Mutex } = require('async-mutex');
const ReadwriteLock = require('readwrite-lock');
//TODO
class ConsistentHash {
    constructor(nreplicas,replicas = 100) {
        this.replicas = replicas;
        this.nreplicas = nreplicas;
        this.ring = new Map();
        this.nodes = new Set();
        this.lock = new Mutex();
    }
    async addNode(node) {
        await this.lock.acquire();
        this.nodes.add(node);
        // Add virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.set(hash, node);
        }
        this.lock.release();
    }

    async removeNode(node) {
        await this.lock.acquire();
        this.nodes.delete(node);
        // Remove virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.delete(hash);
        }
        this.lock.release();
    }

    async getNode(key) {
        if (this.ring.size === 0) return null;
        await this.lock.acquire();
        const hash = this.getHash(key);
        const sortedHashes = Array.from(this.ring.keys()).sort();
        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        const result = [];
        for (const h of sortedHashes) {
            if (h >= hash){
                const node = this.ring.get(h);
                if(!result.includes(node)) result.push(node);
            }
            if (result.length >= this.nreplicas*2) break;
        }
        // complete the circle in the hash ring
        if (result.length < this.nreplicas*2){
            for (const h of sortedHashes) {
                const node = this.ring.get(h);
                if(!result.includes(node)) result.push(node);
                if (result.length >= this.nreplicas*2) break;
            }
        }
        console.log(result);
        this.lock.release();
        return result;
    }
        async getPreferrencedList(key) {
        if (this.ring.size === 0) return null;
        await this.lock.acquire();
        const hash = this.getHash(key);
        const sortedHashes = Array.from(this.ring.keys()).sort();
        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        const result = [];
        for (const h of sortedHashes) {
            if (h >= hash){
                const node = this.ring.get(h);
                if(!result.includes(node)) result.push(node);
            }
            if (result.length >= this.nreplicas*2) break;
        }
        // complete the circle in the hash ring
        if (result.length < this.nreplicas*2){
            for (const h of sortedHashes) {
                const node = this.ring.get(h);
                if(!result.includes(node)) result.push(node);
                if (result.length >= this.nreplicas*2) break;
            }
        }
        console.log(result);
        this.lock.release();
        return result;
    }

    getHash(key) {
        return crypto.createHash('sha1').update(key).digest('hex');
    }
}
module.exports = ConsistentHash;
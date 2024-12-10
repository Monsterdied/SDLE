const crypto = require('crypto');
const { Mutex } = require('async-mutex');
//TODO
class ConsistentHash {
    constructor(nreplicas,replicas = 100) {
        this.replicas = replicas;
        this.nreplicas = nreplicas;
        this.ring = new Map();
        this.nodes = new Set();
        this.lock = new Mutex();
        this.sortedHashes = [];
    }
    async addNode(node) {
        await this.lock.acquire();
        this.nodes.add(node);
        // Add virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.set(hash, `${node}:${i}`);
        }
        this.sortedHashes = Array.from(this.ring.keys()).sort();
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
        this.sortedHashes = Array.from(this.ring.keys()).sort();
        this.lock.release();
    }
    async getNextNode(key){
        if (this.ring.size === 0) return null;
        await this.lock.acquire();
        const hash = this.getHash(key);

        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        for (const h of this.sortedHashes) {
            if (h > hash && this.ring.get(h).split(':')[0] !== key.split(':')[0]){
                const node = this.ring.get(h);
                this.lock.release();
                return node;
            }
        }
        // complete the circle in the hash ring
        for (const h of this.sortedHashes) {
            const node = this.ring.get(h);
            this.lock.release();
            return node;
        }
    }

    async getNode(key) {
        if (this.ring.size === 0) return null;
        await this.lock.acquire();
        const hash = this.getHash(key);
        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        const result = [];
        const nodeParents = [];
        for (const h of this.sortedHashes) {
            if (h >= hash){
                const node = this.ring.get(h);
                if(!nodeParents.includes(node.split(':')[0])){
                    //console.log("TEST",node.split(':')[0]);
                    //console.log("Test",nodeParents);
                    nodeParents.push(node.split(':')[0]);
                    result.push(node);
                } 
            }
            if (result.length >= this.nreplicas*2) break;
        }
        // complete the circle in the hash ring
        if (result.length < this.nreplicas*2){
            for (const h of sortedHashes) {
                const node = this.ring.get(h);
                if(!nodeParents.includes(node.split(':')[0])){
                    nodeParents.push(node.split(':')[0]);
                    result.push(node);
                } 
                if (result.length >= this.nreplicas*2) break;
            }
        }
        console.log(result);
        this.lock.release();
        return result;
    }
    async getPreferrencedList(key,lenghtPreference =this.nreplicas*2) {
        if (this.ring.size === 0) return null;
        await this.lock.acquire();
        const hash = this.getHash(key);
        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        const result = [];
        const nodeParents = [];
        for (const h of this.sortedHashes) {
            if (h >= hash){
                const node = this.ring.get(h);

            }
            if (result.length >= lenghtPreference) break;
        }
        // complete the circle in the hash ring
        if (result.length < lenghtPreference){
            for (const h of this.sortedHashes) {
                const node = this.ring.get(h);
                if(!nodeParents.includes(node.split(':')[0])){
                    nodeParents.push(node.split(':')[0]);
                    result.push(node);
                } 
                if (result.length >= lenghtPreference) break;
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
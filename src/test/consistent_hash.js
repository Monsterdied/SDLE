const crypto = require('crypto');
const { Mutex } = require('async-mutex');
const ReadwriteLock = require('readwrite-lock');
//TODO
class ConsistentHash {
    constructor(replicas = 100) {
        this.replicas = replicas;
        this.ring = new Map();
        this.nodes = new Set();
        this.lock = new Mutex();
    }
    safeRead() {

    }
    addNode(node) {
        this.lock.acquire();
        this.nodes.add(node);
        // Add virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.set(hash, node);
        }
        this.lock.release();
    }

    removeNode(node) {
        this.lock.acquire();
        this.nodes.delete(node);
        // Remove virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.delete(hash);
        }
        this.lock.release();
    }

    getNode(key) {
        if (this.ring.size === 0) return null;
        this.lock.acquire();
        const hash = this.getHash(key);
        const sortedHashes = Array.from(this.ring.keys()).sort();
        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        for (const h of sortedHashes) {
            if (h >= hash) return this.ring.get(h);
        }
        const result = this.ring.get(sortedHashes[0]);
        this.lock.release();
        return result;
    }

    getHash(key) {
        return crypto.createHash('sha1').update(key).digest('hex');
    }
}
module.exports = ConsistentHash;
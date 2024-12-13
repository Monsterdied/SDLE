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
        this.reversedHashes = [];
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
        this.reversedHashes = Array.from(this.ring.keys()).sort().reverse();
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
        this.reversedHashes = Array.from(this.ring.keys()).sort().reverse();
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

    async getPreferrencedList(key,lenghtPreference =this.nreplicas*2,reversed=false) {
        if (this.ring.size === 0) return null;
        let list;
        if(reversed===true){
            list = this.reversedHashes;
        }else{
            list = this.sortedHashes;
        }
        await this.lock.acquire();
        const hash = this.getHash(key);
        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        const result = [];
        const nodeParents = [];
        for (const h of list) {
            if (h >= hash){
                const node = this.ring.get(h);
                if(!nodeParents.includes(node.split(':')[0])){
                    nodeParents.push(node.split(':')[0]);
                    result.push(node);
                } 
            }
            if (result.length >= lenghtPreference) break;
        }
        // complete the circle in the hash ring
        if (result.length < lenghtPreference){
            for (const h of list) {
                const node = this.ring.get(h);
                if(!nodeParents.includes(node.split(':')[0])){
                    nodeParents.push(node.split(':')[0]);
                    result.push(node);
                } 
                if (result.length >= lenghtPreference) break;
            }
        }
        this.lock.release();
        return result;
    }

    getHash(key) {
        return crypto.createHash('sha1').update(key).digest('hex');
    }
    getVirtualNodes(key){
        const virtualNodes = [];
        for (let i = 0; i < this.replicas; i++) {
            virtualNodes.push(`${key}:${i}`);
        }
        return virtualNodes;
    }

    async getNextXNodes(vnode,nNodes){
        if (this.ring.size === 0) return null;
        const lenghtPreference = nNodes;
        await this.lock.acquire();
        const list = this.reversedHashes;
        const hash = this.getHash(vnode);
        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        const nodeId = vnode.split(':')[0];
        const result = [];
        let i = 0;
        for (const h of list) {
            if (h >= hash){
                const node = this.ring.get(h);
                if(nodeId !== node.split(':')[0]){
                    let object = {};
                    if(i === this.reversedHashes.length-1){
                        object.start = node;
                        object.end = this.ring.get(this.reversedHashes[0]);
                        result.push(object);
                    }else{
                        object.start = node;
                        object.end = this.ring.get(this.reversedHashes[i+1]);
                        result.push(object);
                    }
                }else{
                    //if one of the next nodes is the same as the vnode, we skip it 
                    // because none of the other will send theres replicas to me
                    // knowing that we are the same node 
                    return result;
                } 
                i++;
            }
            if (result.length >= lenghtPreference) break;
        }
        // complete the circle in the hash ring
        i=0;
        if (result.length < lenghtPreference){
            for (const h of list) {
                const node = this.ring.get(h);
                if(nodeId !== node.split(':')[0]){
                    let object = {};
                    if(i === this.reversedHashes.length-1){
                        object.start = node;
                        object.end = this.ring.get(this.reversedHashes[0]);
                        result.push(object);
                    }else{
                        object.start = node;
                        object.end = this.ring.get(this.reversedHashes[i+1]);
                        result.push(object);
                    }
                }else{
                    return result;
                }
                i++;
                if (result.length >= lenghtPreference) break;
            }
        }
        this.lock.release();
        return result;
    }
}
module.exports = ConsistentHash;
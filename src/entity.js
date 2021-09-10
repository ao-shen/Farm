import * as THREE from 'three';
import { Farm } from './farm';
import { PriorityQueue } from './priority_queue';
import { BLOCK, Block } from './block.js';
import { Vector3 } from 'three';

export class Entity {
    constructor(Farm, x, z, type, name = null) {
        this.Farm = Farm;
        this.pos = new THREE.Vector3(x * Farm.blockSize, 0, z * Farm.blockSize);
        this.type = type;
        this.name = name;

        this.path = null;

        this.parentBuilding = null;

        this.mesh = this.Farm.ENTITIES[this.type].meshes[0].clone();
        this.mesh.center = this.Farm.ENTITIES[this.type].meshes[0].center;
        this.Farm.scene.add(this.mesh);

        let thisEntity = this;
        this.Farm.scheduler.addToSchedule(1000, function() {
            return thisEntity.onSchedule();
        });
    }

    onSchedule() {

        if (this.path == null) {
            this.path = this.pathFind({ x: 0, z: 0 });
        }

        return true;
    }

    update() {
        if (this.path != null) {
            let curBlockPos = this.Farm.posToBlocks(this.pos.x, this.pos.z);

            if (this.path[0].x == curBlockPos.x && this.path[0].z == curBlockPos.z) {
                this.path.shift();
                if (this.path.length == 0) {
                    this.path = null;
                    return;
                }
            }

            let velocity = new Vector3((this.path[0].x) * this.Farm.blockSize - this.pos.x, 0, (this.path[0].z) * this.Farm.blockSize - this.pos.z);
            velocity.normalize();
            velocity.multiplyScalar(1);

            this.pos.x += velocity.x;
            this.pos.z += velocity.z;
        }
    }

    render() {
        if (this.mesh) {
            this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
        }
    }

    isCollidingAt(x, z) {

        if (x < 0 || x > Farm.numBlocks.x - 1 || z < 0 || z > Farm.numBlocks.z - 1)
            return true;

        let curBlock = this.Farm.blocks[x + ',' + z];

        if (curBlock.type == BLOCK.SOIL) {
            return true;
        }

        if (curBlock.buildings.length == 0) {
            return false;
        }

        return true;
    }

    pathFind(goal) {

        function chebyshevDist(x, z) {
            let distX = Math.abs(x - goal.x);
            let distZ = Math.abs(z - goal.z);
            let min = Math.min(distX, distZ);
            let max = Math.max(distX, distZ);
            return max - min + min * 1.414;
        }

        function heuristic(x, z, pathLength) {
            return chebyshevDist(x, z);
        }

        let curBlockPos = this.Farm.posToBlocks(this.pos.x, this.pos.z);
        let startX = curBlockPos.x;
        let startZ = curBlockPos.z;

        let vis = {};

        let pq = new PriorityQueue(function(a, b) {
            if (a.heuristic == b.heuristic) {
                return a.pathLength < b.pathLength;
            }
            return a.heuristic < b.heuristic;
        });
        pq.push({ x: startX, z: startZ, pathLength: 0, parent: null, heuristic: heuristic(startX, startZ, 0) });
        vis[startX + ',' + startZ] = 1;

        while (!pq.isEmpty()) {
            let cur = pq.pop();

            for (const direction of DIRECTIONS) {
                let newX = cur.x + direction.x;
                let newZ = cur.z + direction.z;

                if (!((newX + ',' + newZ) in vis) && !this.isCollidingAt(newX, newZ)) {

                    if (newX == goal.x && newZ == goal.z) {

                        let path = [{ x: newX, z: newZ }];

                        while (cur != null) {
                            path.unshift({ x: cur.x, z: cur.z });

                            cur = cur.parent;
                        }

                        return path;
                    }

                    pq.push({ x: newX, z: newZ, pathLength: cur.pathLength + 1, parent: cur, heuristic: heuristic(newX, newZ, cur.pathLength + 1) });
                    vis[newX + ',' + newZ] = 1;
                }
            }
        }

        return null;
    }
}

const DIRECTIONS = [
    { x: 0, z: 1 },
    { x: 1, z: 1 },
    { x: 1, z: 0 },
    { x: 1, z: -1 },
    { x: 0, z: -1 },
    { x: -1, z: -1 },
    { x: -1, z: 0 },
    { x: -1, z: 1 },
];
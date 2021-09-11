import * as THREE from 'three';
import { Farm } from './farm';
import { PriorityQueue } from './priority_queue';
import { BLOCK, Block } from './block.js';
import { Vector3 } from 'three';
import { Plant } from './plant';

export class Entity {
    constructor(Farm, x, z, type, name = null) {
        this.Farm = Farm;
        this.pos = new THREE.Vector3(x * Farm.blockSize, 0, z * Farm.blockSize);
        this.type = type;
        this.name = name;

        this.path = null;
        this.pathMesh = null;
        this.goal = null;

        this.parentBuilding = null;

        this.mesh = this.Farm.ENTITIES[this.type].meshes[0].clone();
        this.mesh.center = this.Farm.ENTITIES[this.type].meshes[0].center;
        this.Farm.scene.add(this.mesh);

        let thisEntity = this;
        this.Farm.scheduler.addToSchedule(1000, function() {
            return thisEntity.navigateToTarget();
        });
    }

    onSchedule() {

        return false;
    }

    navigateHome() {

        this.goal = null;

        this.path = this.pathFind(this.parentBuilding.pos);
        if (this.path != null) {
            this.goal = this.parentBuilding;
            this.renderPath();
            return false;
        }
        return true;

    }

    navigateToTarget() {

        this.goal = null;

        switch (this.Farm.ENTITIES[this.type].name) {
            case "Worker":
                let goalPlant = this.findMaturePlant();
                if (goalPlant != null) {
                    goalPlant = goalPlant.element.obj;
                    this.goal = goalPlant;
                    this.path = this.pathFind(goalPlant.block);
                    if (this.path != null) {
                        goalPlant.harvestClaim(this);
                        this.renderPath();
                        return false;
                    }
                }
                break;
        }
        return true;
    }

    renderPath() {
        if (this.Farm.flagRenderPaths) {

            let geometry = new THREE.BufferGeometry();

            let pathVertices = [];

            for (let vertex of this.path) {
                pathVertices.push(vertex.x * this.Farm.blockSize);
                pathVertices.push(5);
                pathVertices.push(vertex.z * this.Farm.blockSize);
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pathVertices), 3));

            let material = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, linewidth: 3 });

            this.pathMesh = new THREE.Line(geometry, material);
            this.Farm.scene.add(this.pathMesh);
        }
    }

    findMaturePlant() {

        let rangeRadius = 10;
        let curBlockPos = this.Farm.posToBlocks(this.pos.x, this.pos.z);

        let nearest = this.Farm.plantsAwaitingHarvest.findNearest(curBlockPos, rangeRadius);

        return nearest;
    }

    performActionAtTarget() {

        if (this.goal.actionCategory == "harvest") {
            this.goal.harvest();
        }

        let thisEntity = this;
        this.Farm.scheduler.addToSchedule(100, function() {
            return thisEntity.navigateHome();
        });
    }

    update() {
        if (this.path != null) {
            if (Math.pow(this.path[0].x * Farm.blockSize - this.pos.x, 2) + Math.pow(this.path[0].z * Farm.blockSize - this.pos.z, 2) < 1) {
                this.path.shift();
                if (this.path.length == 0) {
                    this.path = null;
                    if (this.pathMesh != null) {
                        this.Farm.scene.remove(this.pathMesh);
                        this.pathMesh.geometry.dispose();
                        this.pathMesh.material.dispose();
                        this.pathMesh = null;
                    }
                    let curBlockPos = this.Farm.posToBlocks(this.pos.x, this.pos.z);
                    let thisEntity = this;
                    if (this.goal == this.parentBuilding) {
                        this.Farm.scheduler.addToSchedule(1000, function() {
                            return thisEntity.navigateToTarget();
                        });
                    } else {
                        switch (this.Farm.ENTITIES[this.type].name) {
                            case "Worker":
                                this.Farm.scheduler.addToSchedule(1000, function() {
                                    return thisEntity.performActionAtTarget();
                                });
                                break;
                        }
                    }
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

        /*if (curBlock.type == BLOCK.SOIL) {
            return true;
        }*/

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

                if (direction.blocking.length == 2) {
                    if (this.isCollidingAt(cur.x + direction.blocking[0].x, cur.z + direction.blocking[0].z)) continue;
                    if (this.isCollidingAt(cur.x + direction.blocking[1].x, cur.z + direction.blocking[1].z)) continue;
                }

                if (newX == goal.x && newZ == goal.z) {

                    let path = [{ x: newX, z: newZ }];

                    while (cur != null) {
                        path.unshift({ x: cur.x, z: cur.z });

                        cur = cur.parent;
                    }

                    return path;
                }

                if (!((newX + ',' + newZ) in vis) && !this.isCollidingAt(newX, newZ) && cur.pathLength + direction.length < 30) {
                    pq.push({ x: newX, z: newZ, pathLength: cur.pathLength + direction.length, parent: cur, heuristic: heuristic(newX, newZ, cur.pathLength + 1) });
                    vis[newX + ',' + newZ] = 1;
                }
            }
        }

        return null;
    }
}

const DIRECTIONS = [
    { x: 0, z: 1, length: 1, blocking: [] },
    { x: 1, z: 1, length: 1.414, blocking: [{ x: 0, z: 1 }, { x: 1, z: 0 }] },
    { x: 1, z: 0, length: 1, blocking: [] },
    { x: 1, z: -1, length: 1.414, blocking: [{ x: 0, z: -1 }, { x: 1, z: 0 }] },
    { x: 0, z: -1, length: 1, blocking: [] },
    { x: -1, z: -1, length: 1.414, blocking: [{ x: 0, z: -1 }, { x: -1, z: 0 }] },
    { x: -1, z: 0, length: 1, blocking: [] },
    { x: -1, z: 1, length: 1.414, blocking: [{ x: 0, z: 1 }, { x: -1, z: 0 }] },
];
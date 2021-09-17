import * as THREE from 'three';
import { Farm } from './farm';
import { PriorityQueue } from './priority_queue';
import { BLOCK, Block } from './block.js';
import { Vector3 } from 'three';
import { Plant } from './plant';
import { InfoBox } from './info_box';
import { Inventory } from './inventory';

export class Entity {
    constructor(Farm, idx, x, z, type) {
        this.Farm = Farm;
        this.idx = idx;
        this.pos = new THREE.Vector3(x, 0, z);
        this.type = type;
        this.name = "Entity_" + this.idx;;

        this.path = null;
        this.pathMesh = null;
        this.goal = null;

        this.parentBuilding = null;

        this.mesh = this.Farm.ENTITIES[this.type].meshes[0].clone();
        this.mesh.center = this.Farm.ENTITIES[this.type].meshes[0].center;
        this.mesh.owner = this;
        this.mesh.name = this.name;
        this.Farm.groupInfoable.add(this.mesh);

        if (this.Farm.ENTITIES[this.type].inventorySlots) {
            this.inventory = new Inventory(this.Farm.ENTITIES[this.type].inventorySlots);
        }

        let thisEntity = this;
        this.Farm.scheduler.addToSchedule(1000, function() {
            return thisEntity.logic();
        }, this);

        this.infoBox = new InfoBox(this.Farm, this);
        this.infoBox.addText(this.name);
        this.infoBox.addInventory(this.inventory);
    }

    showInfoBox() {

        let pos = this.Farm.posToScreenPos(this.Farm.getCenterPoint(this.mesh), this.Farm.camera);

        this.infoBox.updatePosition(pos.x, pos.y);

        this.infoBox.show();
    }

    logic() {
        if (this.inventory.isFull()) {
            if (this.isAtHome()) {
                this.inventory.transferAllTo(this.parentBuilding.inventory);
                return true;
            } else {
                return this.navigateHome();
            }
        } else {
            if (this.isAtHome()) {
                return this.navigateToTarget();
            } else {
                return this.navigateHome();
            }
        }
    }

    isAtHome() {
        return Math.pow(this.parentBuilding.center.x - this.pos.x, 2) + Math.pow(this.parentBuilding.center.z - this.pos.z, 2) < 2
    }

    navigateHome() {

        this.goal = null;

        this.path = this.pathFind(this.parentBuilding.centerBlock);
        if (this.path != null) {
            this.path.push({ x: this.parentBuilding.center.x / this.Farm.blockSize, z: this.parentBuilding.center.z / this.Farm.blockSize })
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
            if (!this.goal.isRemoved) {
                if (!this.inventory.isFull()) {
                    this.goal.harvest();
                    this.inventory.add(this.goal.type, 1);
                }
            }
        }

        let thisEntity = this;
        this.Farm.scheduler.addToSchedule(1000, function() {
            return thisEntity.logic();
        }, this);
    }

    reachedTarget() {
        let curBlockPos = this.Farm.posToBlocks(this.pos.x, this.pos.z);
        let thisEntity = this;
        if (this.goal == this.parentBuilding) {
            this.Farm.scheduler.addToSchedule(1000, function() {
                return thisEntity.logic();
            }, this);
        } else {
            switch (this.Farm.ENTITIES[this.type].name) {
                case "Worker":
                    this.Farm.scheduler.addToSchedule(100, function() {
                        return thisEntity.performActionAtTarget();
                    }, this);
                    break;
            }
        }
    }

    update() {
        if (this.path != null) {

            let allowedDeviationFromPathSquared = 20;

            if (this.path.length == 1) {
                allowedDeviationFromPathSquared = 1;
            }

            if (Math.pow(this.path[0].x * Farm.blockSize - this.pos.x, 2) + Math.pow(this.path[0].z * Farm.blockSize - this.pos.z, 2) < allowedDeviationFromPathSquared) {
                this.path.shift();
                if (this.path.length == 0) {
                    this.path = null;
                    if (this.pathMesh != null) {
                        this.Farm.scene.remove(this.pathMesh);
                        this.pathMesh.geometry.dispose();
                        this.pathMesh.material.dispose();
                        this.pathMesh = null;
                    }

                    this.reachedTarget();

                    return;
                }
            }

            let velocity = new Vector3((this.path[0].x) * this.Farm.blockSize - this.pos.x, 0, (this.path[0].z) * this.Farm.blockSize - this.pos.z);
            velocity.normalize();
            velocity.multiplyScalar(1);

            this.pos.x += velocity.x;
            this.pos.z += velocity.z;
            this.mesh.lookAt(this.pos);
        }
    }

    render() {
        if (this.mesh) {
            this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
            this.infoBox.render();
        }
    }

    remove() {
        if (this.pathMesh) {
            this.pathMesh.geometry.dispose();
            this.pathMesh.material.dispose();
            this.Farm.scene.remove(this.pathMesh);
        }

        this.infoBox.remove();

        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.Farm.groupInfoable.remove(this.mesh);

        delete this.Farm.entities[this.idx];

        this.isRemoved = true;
    }

    isCollidingAt(curPos, direction, isTarget = false) {

        let x = curPos.x + direction.x;
        let z = curPos.z + direction.z;

        if (x < 0 || x > Farm.numBlocks.x - 1 || z < 0 || z > Farm.numBlocks.z - 1)
            return true;

        let curBlock = this.Farm.blocks[x + ',' + z];

        if (curBlock.groundState == Farm.GROUND_STATES_NAMES.WATER) {
            return true;
        }

        if (curBlock.buildings.length == 0) {
            return false;
        }

        for (let building of curBlock.buildings) {
            if (building.isWall) {
                if (direction.destSides.includes(building.side)) {
                    return true;
                }
            } else if (building.isPath || building == this.parentBuilding) {

            } else {
                if (!isTarget) {
                    return true;
                }
            }
        }

        return false;
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

                // Collision tests
                let selfCollide = false;
                let curBlock = this.Farm.blocks[cur.x + ',' + cur.z];
                for (let building of curBlock.buildings) {
                    if (building.isWall) {
                        if (direction.sides.includes(building.side)) {
                            selfCollide = true;
                            break;
                        }
                    }
                }
                if (selfCollide) continue;
                if (this.isCollidingAt(cur, direction, newX == goal.x && newZ == goal.z)) continue;
                if (direction.blocking.length == 2) {
                    if (this.isCollidingAt(cur, direction.blocking[0])) continue;
                    if (this.isCollidingAt(cur, direction.blocking[1])) continue;
                }

                // If target reached
                if (newX == goal.x && newZ == goal.z) {

                    let path = [{ x: newX, z: newZ }];

                    while (cur != null) {
                        path.unshift({ x: cur.x, z: cur.z });

                        cur = cur.parent;
                    }

                    return path;
                }

                // Otherwise
                if (!((newX + ',' + newZ) in vis) && cur.pathLength + direction.length < 30) {
                    pq.push({ x: newX, z: newZ, pathLength: cur.pathLength + direction.length, parent: cur, heuristic: heuristic(newX, newZ, cur.pathLength + 1) });
                    vis[newX + ',' + newZ] = 1;
                }
            }
        }

        return null;
    }
}

const NORTH = 0;
const EAST = 1;
const SOUTH = 2;
const WEST = 3;

const DIRECTIONS = [{
        x: 0,
        z: 1,
        sides: [EAST],
        destSides: [WEST],
        length: 1,
        blocking: []
    },
    {
        x: 1,
        z: 1,
        sides: [EAST, NORTH],
        destSides: [WEST, SOUTH],
        length: 1.414,
        blocking: [{ x: 0, z: 1, destSides: [WEST, NORTH] }, { x: 1, z: 0, destSides: [EAST, SOUTH] }]
    },
    {
        x: 1,
        z: 0,
        sides: [NORTH],
        destSides: [SOUTH],
        length: 1,
        blocking: []
    },
    {
        x: 1,
        z: -1,
        sides: [WEST, NORTH],
        destSides: [EAST, SOUTH],
        length: 1.414,
        blocking: [{ x: 0, z: -1, destSides: [EAST, NORTH] }, { x: 1, z: 0, destSides: [WEST, SOUTH] }]
    },
    {
        x: 0,
        z: -1,
        sides: [WEST],
        destSides: [EAST],
        length: 1,
        blocking: []
    },
    {
        x: -1,
        z: -1,
        sides: [WEST, SOUTH],
        destSides: [EAST, NORTH],
        length: 1.414,
        blocking: [{ x: 0, z: -1, destSides: [EAST, SOUTH] }, { x: -1, z: 0, destSides: [WEST, NORTH] }]
    },
    {
        x: -1,
        z: 0,
        sides: [SOUTH],
        destSides: [NORTH],
        length: 1,
        blocking: []
    },
    {
        x: -1,
        z: 1,
        sides: [EAST, SOUTH],
        destSides: [WEST, NORTH],
        length: 1.414,
        blocking: [{ x: 0, z: 1, destSides: [WEST, SOUTH] }, { x: -1, z: 0, destSides: [EAST, NORTH] }]
    },
];
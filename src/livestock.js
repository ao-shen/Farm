import * as THREE from './three/src/Three';

import { spawnCustomers } from "./customer";
import { DIRECTIONS, Entity } from "./entity";
export class Livestock extends Entity {
    constructor(Farm, idx, x, z, type, variation = 0) {
        super(Farm, idx, x, z, type, variation);

        this.isLivestock = true;

        this.maxPathLength = 2;

        this.randomWander = 0;
        this.randomFrame = 0;

        this.meshRotation = Math.random() * Math.PI * 2;
        this.meshRotationVelocity = 0;

        this.allowedDeviationFromGoalSquared = 20;
    }

    logic() {
        switch (this.state) {
            case 0:
                return this.wander();
        }
    }

    wander() {
        let cur = this.Farm.posToBlocks(this.pos.x, this.pos.z);
        let dest = null;
        let destDensity = this.Farm.blocks[cur.x + ',' + cur.z].livestockDensity;
        this.dest = null;

        //if (destDensity < 150 && Math.random() < 0.5) { return true; }

        //dest.x = randRange(Math.max(0, dest.x - 5), Math.min(this.Farm.numBlocks.x, dest.x + 5));
        //dest.z = randRange(Math.max(0, dest.z - 5), Math.min(this.Farm.numBlocks.z, dest.z + 5));

        let randomStart = Math.floor(Math.random() * DIRECTIONS.length);
        for (let i = 0; i < DIRECTIONS.length; i++) {
            let DIRECTION = DIRECTIONS[(randomStart + i) % DIRECTIONS.length];
            let x = cur.x + DIRECTION.x;
            let z = cur.z + DIRECTION.z;
            let density = 0;
            if (this.Farm.blocks[x + ',' + z]) {
                density += this.Farm.blocks[x + ',' + z].livestockDensity;
            } else {
                if (x < 0) {
                    density += 100000 * (-x + 1);
                }
                if (z < 0) {
                    density += 100000 * (-z + 1);
                }
            }
            if (dest == null || density < destDensity) {
                let path = this.pathFind({ x: x, z: z });
                if (path != null) {
                    this.path = path;
                    dest = { x: x, z: z };
                    destDensity = density;
                }
            }
        }

        if (dest == null) {
            return true;
        }

        this.dest = dest;

        let curBlockIdx = (this.dest.x + ',' + this.dest.z);
        let curBlock = this.Farm.blocks[curBlockIdx];
        curBlock.livestockDensity += 1;
        this.Farm.livestockedBlocks[curBlockIdx] = curBlock;

        /*if (this.isCollidingAt(dest, NO_DIRECTION)) {
            return true;
        }*/

        //this.path = this.pathFind(dest);

        this.renderPath();
        return false;
    }

    reachedTarget() {

        let result = this.logic();
        if (result) {
            let thisEntity = this;
            this.Farm.scheduler.addToSchedule(1000, function() {
                return thisEntity.logic();
            }, this);
        }
    }

    // false = no collision
    // true = collision
    isCollidingAt(curPos, direction, isTarget = false) {

        let x = curPos.x + direction.x;
        let z = curPos.z + direction.z;

        if (x < 0 || x > this.Farm.numBlocks.x - 1 || z < 0 || z > this.Farm.numBlocks.z - 1)
            return true;

        let curBlock = this.Farm.blocks[x + ',' + z];

        let hasPath = false;
        for (let building of curBlock.buildings) {
            if (building.isPath) {
                hasPath = true;
                break;
            }
        }

        let isAtParent = false;
        for (let otherBlock of this.parentBuilding.foundationBlocks) {
            if (otherBlock == curBlock) {
                isAtParent = true;
                break;
            }
        }

        for (let building of curBlock.buildings) {
            if (building.isWall) {
                if (direction.destSides.includes(building.side)) {
                    return true;
                }
            } else if (building.isPath || building == this.parentBuilding) {

            } else if (building.isConnectible && hasPath) {

            } else {
                if (!isTarget) {
                    return true;
                }
            }
        }

        return false;
    }

    update() {
        super.update();

        /*this.randomFrame++;
        if (this.randomFrame >= 5) {
            this.randomFrame = 0;

            let density1 = this.getDensityAt(new THREE.Vector3(this.pos.x + 20 * Math.cos(-this.meshRotation - 0.15), 0, this.pos.z + 20 * Math.sin(-this.meshRotation - 0.15)));
            let density2 = this.getDensityAt(new THREE.Vector3(this.pos.x + 20 * Math.cos(-this.meshRotation), 0, this.pos.z + 20 * Math.sin(-this.meshRotation)));
            let density3 = this.getDensityAt(new THREE.Vector3(this.pos.x + 20 * Math.cos(-this.meshRotation + 0.15), 0, this.pos.z + 20 * Math.sin(-this.meshRotation + 0.15)));

            if (density1 < density2 && density1 < density3) {
                this.meshRotationVelocity = 0.03;
            } else if (density3 < density2 && density3 < density1) {
                this.meshRotationVelocity = -0.03;
            } else {
                this.meshRotationVelocity = 0;
            }
        }

        this.meshRotation += this.meshRotationVelocity;

        this.meshRotation = (this.meshRotation + 2 * Math.PI) % (2 * Math.PI);

        let velocity = new THREE.Vector3(Math.cos(-this.meshRotation), 0, Math.sin(-this.meshRotation));
        velocity.multiplyScalar(0.1);

        let timeScale = velocity.length() / 0.04;

        this.pos.x += velocity.x;
        this.pos.z += velocity.z;

        if (this.mixer) {
            this.mixer.timeScale = timeScale;
        } else if (typeof this.animationTime !== "undefined") {
            this.animationTime += this.Farm.elapsed / 1000 * timeScale;
        }*/

    }

    render() {
        super.render();

        let curBlockPos = this.Farm.posToBlocks(this.pos.x, this.pos.z);
        let curBlockIdx = (curBlockPos.x + ',' + curBlockPos.z);
        let curBlock = this.Farm.blocks[curBlockIdx];

        if (curBlock) {
            curBlock.livestockDensity += 1;
            this.Farm.livestockedBlocks[curBlockIdx] = curBlock;
        }
        if (this.dest && (curBlockPos.x != this.dest.x || curBlockPos.z != this.dest.z)) {
            curBlockIdx = (this.dest.x + ',' + this.dest.z);
            curBlock = this.Farm.blocks[curBlockIdx];
            curBlock.livestockDensity += 0.5;
            this.Farm.livestockedBlocks[curBlockIdx] = curBlock;
        }
    }

    getDensityAt(pos) {

        let density = 0;

        let ox = Math.round(pos.x / this.Farm.blockSize + 0.5);
        let oz = Math.round(pos.z / this.Farm.blockSize + 0.5);

        for (let neighbor of NEIGHBORS) {

            let x = ox + neighbor.x;
            let z = oz + neighbor.z;

            let weight = 2 * Math.pow(this.Farm.blockSize * 0.5, 2) - (Math.pow(pos.x - x * this.Farm.blockSize, 2) + Math.pow(pos.z - z * this.Farm.blockSize, 2));

            if (this.Farm.blocks[x + ',' + z]) {
                density += weight * this.Farm.blocks[x + ',' + z].livestockDensity;
            } else {
                if (x < 0) {
                    density += weight * 100000 * (-x);
                }
                if (z < 0) {
                    density += weight * 100000 * (-z);
                }
            }
        }

        return density;
    }
}

function randRange(a, b) {
    return Math.floor(Math.random() * (b - a) + a);
}

const NO_DIRECTION = {
    x: 0,
    z: 0,
    sides: [],
    destSides: [],
    length: 0,
    blocking: []
}

const NEIGHBORS = [
    { x: 0, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: -1 },
];
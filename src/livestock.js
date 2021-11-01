import { Entity } from "./entity";
export class Livestock extends Entity {
    constructor(Farm, idx, x, z, type, variation = 0) {
        super(Farm, idx, x, z, type, variation);

        this.isLivestock = true;

        this.maxPathLength = 10;
    }

    logic() {
        switch (this.state) {
            case 0:
                return this.wander();
        }
    }

    wander() {
        let dest = this.Farm.posToBlocks(this.pos.x, this.pos.z);

        dest.x = randRange(Math.max(0, dest.x - 5), Math.min(this.Farm.numBlocks.x, dest.x + 5));
        dest.z = randRange(Math.max(0, dest.z - 5), Math.min(this.Farm.numBlocks.z, dest.z + 5));

        if (this.isCollidingAt(dest, NO_DIRECTION)) {
            return true;
        }

        this.path = this.pathFind(dest);
        if (this.path != null) {
            this.renderPath();
            return false;
        }
        return true;
    }

    reachedTarget() {
        let thisEntity = this;
        this.Farm.scheduler.addToSchedule(100, function() {
            return thisEntity.logic();
        }, this);
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
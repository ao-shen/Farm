import * as THREE from 'three';

export class Plant {
    constructor(Farm, idx, x, z, blocks, type, variation = -1) {
        this.Farm = Farm;
        this.idx = idx;
        this.pos = new THREE.Vector3(x, 0, z);
        this.type = type;
        this.blocks = blocks;

        this.hash = this.blocks[0].hash;

        this.harvestPoint = { x: this.blocks[0].x, z: this.blocks[0].z }

        this.isTree = this.Farm.BUILDINGS[this.type].tree;
        this.variation = variation;

        if (this.variation == -1) {
            this.variation = 0;

            if (this.isTree) {
                this.variation = Math.floor(Math.random() * this.Farm.TREES.length);
            }
        }

        this.stage = 0;

        this.harvestClaimer = null;

        this.meshIdx = 0;
        this.treeMeshIdx = 0;

        /*this.Farm.scheduler.addToSchedule(this.Farm.BUILDINGS[this.type].matureTime, , this);*/
        let thisPlant = this;
        this.growthTimeout = setTimeout(function() {
            return thisPlant.onGrowth();
        }, this.getGrowthSpeed());
    }

    getWetness() {
        let averageWetness = 0;
        for (let curBlock of this.blocks) {
            averageWetness += curBlock.wetness;
        }
        return averageWetness / this.blocks.length;
    }

    getGrowthSpeed() {

        let defaultMatureTime = this.Farm.BUILDINGS[this.type].matureTime;

        let averageWetness = this.getWetness();

        if (averageWetness == 0) {
            return defaultMatureTime;
        } else if (averageWetness < 4) {
            return defaultMatureTime;
        } else if (averageWetness < 6) {
            return defaultMatureTime * 2 / 3;
        } else {
            return defaultMatureTime / 3;
        }
    }

    remove() {
        this.Farm.plantsAwaitingHarvest.remove(this.harvestPoint, this);
        this.isRemoved = true;

        if (this.Farm.plants[this.idx] == this) {
            delete this.Farm.plants[this.idx];
        }

        return this.type;
    }

    onGrowth() {
        if (this.isRemoved) return;

        if (this.getWetness() > 0) {

            if (!this.isMature()) {
                this.stage = this.stage + 1;
            }

            this.updateMesh();

            if (this.isMature()) {

                if (!this.isHarvestClaimed()) {
                    this.Farm.plantsAwaitingHarvest.add(this.harvestPoint, this);
                }

                return;
            }
        }

        let thisPlant = this;
        this.growthTimeout = setTimeout(function() {
            return thisPlant.onGrowth();
        }, this.getGrowthSpeed());
    }

    isMature() {
        return this.stage == this.Farm.BUILDINGS[this.type].numStages - 1;
    }

    isHarvestClaimed() {
        return this.harvestClaimer != null;
    }

    harvestClaim(entity) {
        this.Farm.plantsAwaitingHarvest.remove(this.harvestPoint, this);
        this.harvestClaimer = entity;
    }

    harvest() {

        this.stage = 0;

        let thisPlant = this;
        this.growthTimeout = setTimeout(function() {
            return thisPlant.onGrowth();
        }, this.getGrowthSpeed());

        this.harvestClaimer = null;

        this.updateMesh();
    }

    updateMesh() {

        let Farm = this.Farm;

        let matrix = new THREE.Matrix4();
        let matrixTranslate = new THREE.Matrix4();

        let plantBuilding = Farm.BUILDINGS[this.type];

        if (this.isTree) {

            var rand = mulberry32(this.hash);

            let randRotateY = rand() * 2 * Math.PI;
            let randRotateYMatrix = new THREE.Matrix4();
            randRotateYMatrix.makeRotationY(randRotateY);
            let randRotateXMatrix = new THREE.Matrix4();
            randRotateXMatrix.makeRotationX(Math.PI / 2);

            let s = Math.sin(-randRotateY);
            let c = Math.cos(-randRotateY);

            let curMesh = Farm.TREES[this.variation].mesh;

            matrix.makeRotationY(randRotateY);
            matrix.setPosition(
                (this.pos.x) * Farm.blockSize,
                0,
                (this.pos.z) * Farm.blockSize
            );

            curMesh.setMatrixAt(this.treeMeshIdx, matrix);

            let curLeafMesh = Farm.TREES[this.variation].leafMesh;

            for (let i = 0; i < Farm.TREES[this.variation].leaves.length; i++) {

                matrix.identity();

                matrix.setPosition(
                    (this.pos.x) * Farm.blockSize,
                    0,
                    (this.pos.z) * Farm.blockSize
                );

                let newPoint = rotatePoint(s, c, -Farm.TREES[this.variation].leaves[i].x * 5, -Farm.TREES[this.variation].leaves[i].z * 5);

                matrixTranslate.makeTranslation(
                    newPoint.x,
                    Farm.TREES[this.variation].leaves[i].y * 5,
                    newPoint.z
                );
                matrix.multiply(matrixTranslate);
                matrix.multiply(randRotateYMatrix);
                //matrix.multiply(randRotateXMatrix);
                matrix.multiply(Farm.TREES[this.variation].leaves[i].rotationalMatrix);

                curLeafMesh.setMatrixAt(this.treeMeshIdx * Farm.TREES[this.variation].leaves.length + i, matrix);
            }

            if (plantBuilding.customInstances) {

                for (let m = 0; m < plantBuilding.meshes.length; m++) {

                    let curMesh = plantBuilding.meshes[m];

                    var rand = mulberry32(this.hash);

                    let onCurStage = 0;

                    if (this.stage == m) {
                        onCurStage = 1;
                    }

                    let instanceAmount = 4;

                    if (plantBuilding.customInstances[m].amount) {
                        instanceAmount = plantBuilding.customInstances[m].amount;
                    }

                    for (let j = 0; j < instanceAmount; j++) {

                        let i = j % (Farm.TREES[this.variation].leaves.length - 1);

                        matrix.identity();

                        if (plantBuilding.customInstances[m].isLeafRotator) {

                            let hashedX = (0.5 + 0.5 * (rand() - 0.5)) * Math.PI;
                            let hashedY = Farm.TREES[this.variation].leaves[i].rotationalY + randRotateY + 0.5 * (rand() - 0.5) * Math.PI;
                            let hashedZ = rand() * 2 * Math.PI;

                            matrix.setPosition(
                                (this.pos.x) * Farm.blockSize,
                                0,
                                (this.pos.z) * Farm.blockSize
                            );

                            let newPoint = rotatePoint(s, c, -Farm.TREES[this.variation].leaves[i].x * 5, -Farm.TREES[this.variation].leaves[i].z * 5);

                            matrixTranslate.makeTranslation(
                                newPoint.x,
                                Farm.TREES[this.variation].leaves[i].y * 5,
                                newPoint.z
                            );
                            matrix.multiply(matrixTranslate);

                            randRotateYMatrix.makeRotationY(hashedY);
                            matrix.multiply(randRotateYMatrix);
                            randRotateXMatrix.makeRotationX(hashedX);
                            matrix.multiply(randRotateXMatrix);

                        } else if (plantBuilding.customInstances[m].isLeafTranslator) {

                            let hashedX = (0.8 + 0.5 * (rand() - 0.5)) * Math.PI;
                            let hashedY = Farm.TREES[this.variation].leaves[i].rotationalY + randRotateY + (0.5 + 1.0 * (rand() - 0.5)) * Math.PI;
                            let hashedZ = rand() * 2 * Math.PI;

                            matrix.setPosition(
                                (this.pos.x) * Farm.blockSize,
                                0,
                                (this.pos.z) * Farm.blockSize
                            );

                            let newPoint = rotatePoint(s, c, -Farm.TREES[this.variation].leaves[i].x * 5, -Farm.TREES[this.variation].leaves[i].z * 5);

                            let point1 = rotatePoint(Math.sin(hashedX), Math.cos(hashedX), 5, 0);
                            let point2 = rotatePoint(Math.sin(hashedY), Math.cos(hashedY), point1.z, 0);

                            matrixTranslate.makeTranslation(
                                newPoint.x - point2.x,
                                Farm.TREES[this.variation].leaves[i].y * 5 + point1.x,
                                newPoint.z + point2.z
                            );
                            matrix.multiply(matrixTranslate);
                        }

                        //onCurStage *= (rand() - 0.5) * 0.2 + 1;

                        matrix.scale(new THREE.Vector3(onCurStage, onCurStage, onCurStage));

                        curMesh.setMatrixAt(this.meshIdx * instanceAmount + j, matrix);
                    }
                }
            }

        } else {

            for (let m = 0; m < plantBuilding.meshes.length; m++) {

                let curMesh = plantBuilding.meshes[m];

                var rand = mulberry32(this.hash);

                let onCurStage = 0;

                if (this.stage == m) {
                    onCurStage = 1;
                }

                for (let j = 0; j < 4; j++) {

                    let hashedX = (rand() - 0.5) * Farm.blockSize * 0.4;
                    let hashedY = (rand() - 0.5) * Farm.blockSize * 0.05;
                    let hashedZ = (rand() - 0.5) * Farm.blockSize * 0.4;

                    /*matrix.makeRotationY(rand() * 2 * Math.PI);

                    matrix.setPosition(
                        this.pos.x * Farm.blockSize + hashedX + quadPos[j].x * Farm.blockSize * 0.25,
                        hashedY,
                        this.pos.z * Farm.blockSize + hashedZ + quadPos[j].z * Farm.blockSize * 0.25
                    );*/

                    onCurStage *= (rand() - 0.5) * 0.2 + 1;

                    //matrix.scale(new THREE.Vector3(onCurStage, onCurStage, onCurStage));

                    matrix.set(
                        this.pos.x * Farm.blockSize + hashedX + quadPos[j].x * Farm.blockSize * 0.25,
                        hashedY,
                        this.pos.z * Farm.blockSize + hashedZ + quadPos[j].z * Farm.blockSize * 0.25,
                        onCurStage,
                        rand() * 2 * Math.PI * 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
                    );

                    curMesh.setMatrixAt(this.meshIdx * 4 + j, matrix);
                }
            }
        }

        this.Farm.plantTypeAwaitingMeshUpdate.add(this.type);
    }
};

let quadPos = [
    { x: 1, z: 1 },
    { x: -1, z: 1 },
    { x: -1, z: -1 },
    { x: 1, z: -1 },
]

function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function rotatePoint(s, c, x, z, x0 = 0, z0 = 0) {

    x -= x0;
    z -= z0;

    return { x: x * c - z * s + x0, z: x * s + z * c + z0 };
}
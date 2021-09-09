import * as THREE from 'three';

export class Plant {
    constructor(Farm, type, block) {
        this.Farm = Farm;
        this.type = type;
        this.block = block;

        this.stage = 0;

        this.meshIdx = 0;

        let thisPlant = this;
        this.Farm.scheduler.addToSchedule(this.Farm.BUILDINGS[this.type].matureTime, function() {
            return thisPlant.onGrowth();
        });
    }

    onGrowth() {

        this.stage = this.stage + 1;

        this.updateMesh();

        this.Farm.plantTypeAwaitingMeshUpdate.add(this.type);

        return this.stage + 1 < this.Farm.BUILDINGS[this.type].numStages;
    }

    updateMesh() {

        let Farm = this.Farm;

        const matrix = new THREE.Matrix4();

        let plantBuilding = Farm.BUILDINGS[this.type];

        for (let m = 0; m < plantBuilding.meshes.length; m++) {

            let curMesh = plantBuilding.meshes[m];

            var rand = mulberry32(this.block.hash);

            let onCurStage = 0;

            if (this.stage == m) {
                onCurStage = 1;
            }

            for (let j = 0; j < 4; j++) {

                let hashedX = (rand() - 0.5) * Farm.blockSize * 0.4;
                let hashedY = (rand() - 0.5) * Farm.blockSize * 0.05;
                let hashedZ = (rand() - 0.5) * Farm.blockSize * 0.4;

                matrix.makeRotationY(rand() * 2 * Math.PI);

                matrix.setPosition(
                    this.block.x * Farm.blockSize + hashedX + quadPos[j].x * Farm.blockSize * 0.25,
                    hashedY,
                    this.block.z * Farm.blockSize + hashedZ + quadPos[j].z * Farm.blockSize * 0.25
                );

                onCurStage *= (rand() - 0.5) * 0.2 + 1;

                matrix.scale(new THREE.Vector3(onCurStage, -onCurStage, onCurStage));

                curMesh.setMatrixAt(this.meshIdx * 4 + j, matrix);
            }
        }
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
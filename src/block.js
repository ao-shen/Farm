import * as THREE from 'three';
import { maxWaterDepth } from './building';

export class Block {
    constructor(Farm, x, z, type = 0) {
        this.Farm = Farm;
        this.x = x;
        this.z = z;

        this.groundState = 0;
        this.grassBladeIdx = [];
        this.isGrassBladeVisible = true;

        this.type = type;
        this.plants = [];
        this.buildings = [];

        this.mesh = null;

        this.soilVariation = 1;

        this.wetness = 0;

        this.hash = xmur3(x + "+" + z)();
    }

    updateGrassBlades() {

        const matrix = new THREE.Matrix4();

        if (this.type == BLOCK.GRASS && this.plants.length == 0 && this.buildings.length == 0) {
            if (!this.isGrassBladeVisible) {
                this.isGrassBladeVisible = true;
                for (let idx of this.grassBladeIdx) {
                    this.Farm.grassBladeMesh.getMatrixAt(idx, matrix);
                    matrix.elements[5] = 1;
                    this.Farm.grassBladeMesh.setMatrixAt(idx, matrix);
                }
                this.Farm.grassBladeMeshNeedsUpdate = true;
            }
        } else {
            if (this.isGrassBladeVisible) {
                this.isGrassBladeVisible = false;
                for (let idx of this.grassBladeIdx) {
                    this.Farm.grassBladeMesh.getMatrixAt(idx, matrix);
                    matrix.elements[5] = 0;
                    this.Farm.grassBladeMesh.setMatrixAt(idx, matrix);
                }
                this.Farm.grassBladeMeshNeedsUpdate = true;
            }
        }
    }

    updateWetness() {

        let wetSources = 0;
        let wetNumSources = 0;
        let isWater = false;
        for (let i = 0; i < DIRECTIONS.length; i++) {
            let direction = DIRECTIONS[i];
            let otherBlock = this.Farm.blocks[(this.x + direction.x) + ',' + (this.z + direction.z)];

            if (this.x + direction.x < 0) {
                if (wetSources == 6) {
                    wetNumSources++;
                } else {
                    wetSources = 6;
                    wetNumSources = 1;
                }
            } else if (typeof otherBlock === 'undefined') {

            } else {
                for (let building of this.buildings) {
                    if (building.isWaterCarrier && building.waterLevels[0] < maxWaterDepth) {
                        this.wetness = 6;
                        isWater = true;
                        break;
                    }
                }
                if (wetSources < otherBlock.wetness) {
                    wetSources = otherBlock.wetness;
                    wetNumSources = 1;
                } else if (wetSources == otherBlock.wetness) {
                    wetNumSources++;
                }
            }
        }
        if (!isWater) {
            if (wetNumSources == 0) {
                this.wetness -= 1;
            } else if (this.wetness <= wetSources && wetNumSources > 2) {
                this.wetness += 1;
                this.wetness = Math.min(this.wetness, wetSources);
            } else if (this.wetness <= wetSources - 2) {
                this.wetness += 2;
                this.wetness = Math.min(this.wetness, wetSources - 2);
            } else {
                this.wetness -= 1;
            }
            this.wetness = Math.max(0, Math.min(this.wetness, 5));
        }
        this.wetness = Math.max(0, Math.min(this.wetness, 6));

        if (this.wetness == 0) {
            this.soilVariation = 2;
        } else if (this.wetness < 4) {
            this.soilVariation = 1;
        } else if (this.wetness < 6) {
            this.soilVariation = 0;
        } else {
            this.soilVariation = 3;
        }

        this.updateSoilMesh();
    }

    updateSoilMesh() {

        if (this.type == BLOCK.SOIL) {

            let buildingType = 0;

            let Farm = this.Farm;

            const matrix = new THREE.Matrix4();

            let building = Farm.BUILDINGS[buildingType];

            for (let m = 0; m < building.meshes.length; m++) {

                let curMesh = building.meshes[m];

                let onCurVariation = 0;

                if (this.soilVariation == m) {
                    onCurVariation = 1;
                }

                matrix.makeTranslation(
                    this.x * Farm.blockSize,
                    0,
                    this.z * Farm.blockSize
                );

                matrix.scale(new THREE.Vector3(onCurVariation, onCurVariation, onCurVariation));

                curMesh.setMatrixAt(this.soilMeshIdx, matrix);

            }

            this.Farm.plantTypeAwaitingMeshUpdate.add(buildingType);
        }
    }
};

export const BLOCK = {
    GRASS: 0,
    SOIL: 1,
};

function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353),
        h = h << 13 | h >>> 19;
    return function() {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}

const DIRECTIONS = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 0, z: -1 },
];
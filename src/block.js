import * as THREE from './three/src/Three';
import { maxWaterDepth } from './building';

export class Block {
    constructor(Farm, x, z, type = 0) {
        this.Farm = Farm;
        this.x = x;
        this.z = z;

        this.groundState = 0;
        this.grassBladeIdx = [];
        this.isGrassBladeVisible = true;
        this.grassPropertiesIdx = (this.x * 256 + this.z) * 4;
        this.side = 0;

        this.type = type;
        this.plants = [];
        this.buildings = {};

        this.entityVelocity = 1;

        this.mesh = null;

        this.soilVariation = 1;

        this.livestockDensity = 0;

        this.wetness = 0;

        this.hash = xmur3(x + "+" + z)();
    }

    updateGroundState(state, side = 0, updateAttribute = true) {
        let changed = this.groundState != state;
        this.groundState = (state + this.Farm.GROUND_STATES.length) % this.Farm.GROUND_STATES.length;
        this.side = side;

        let curIdx = (this.x * this.Farm.numBlocks.z + this.z) * 8;
        for (let i = 0; i < 8; i++) {
            this.Farm.groundUVs[curIdx + i] = this.Farm.GROUND_STATES[this.groundState].uv[(i + 8 - 2 * side) % 8];
        }
        if (updateAttribute) {
            this.Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.Farm.groundUVs), 2));
        }

        this.updateGrassBlades(true);

        this.entityVelocity = 1;
        if (2 <= this.groundState && this.groundState <= 7) {
            this.entityVelocity = 0.5;
        } else if (8 <= this.groundState && this.groundState <= 13) {
            this.entityVelocity = 0.2;
        }
    }

    updateGrassBlades(force = false) {

        const matrix = new THREE.Matrix4();

        let blockingBuilding = false;
        for (let height in this.buildings) {
            for (let curBuilding of this.buildings[height]) {
                if (curBuilding.isWall || curBuilding.groundStateMutator) {

                } else {
                    blockingBuilding = true;
                    break;
                }
            }
        }

        let blockingPlant = false;
        for (let curPlant of this.plants) {
            if (curPlant.isTree) {

            } else {
                blockingPlant = true;
                break;
            }
        }

        let propertyValue = this.groundState + 1;
        if (this.type == BLOCK.GRASS && !blockingPlant && !blockingBuilding) {
            if (!this.isGrassBladeVisible || force) {
                this.isGrassBladeVisible = true;
            }
        } else {
            if (this.isGrassBladeVisible || force) {
                this.isGrassBladeVisible = false;
            }
            propertyValue = 0;
        }
        this.Farm.grassPropertiesMap.image.data[this.grassPropertiesIdx + 0] = propertyValue / 256;
        this.Farm.grassPropertiesMap.image.data[this.grassPropertiesIdx + 1] = this.side / 4;
        this.Farm.grassBladeMeshNeedsUpdate = true;
        this.Farm.grassPropertiesMap.needsUpdate = true;
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
                for (let height in this.buildings) {
                    for (let building of this.buildings[height]) {
                        if (building.isWaterCarrier && building.leaky && building.waterLevels[0] < maxWaterDepth) {
                            this.wetness = 6;
                            isWater = true;
                            break;
                        }
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

    addBuilding(building) {
        let height = building.height;
        if (!height) height = 0;
        if (!this.buildings[height]) {
            this.buildings[height] = [];
        }
        this.buildings[height].push(building);
    }

    removeBuilding(building) {
        let height = building.height;
        if (!height) height = 0;
        if (!this.buildings[height]) {
            return;
        }
        var index = this.buildings[height].indexOf(building);
        if (index !== -1) {
            this.buildings.splice(index, 1);
            this.updateGrassBlades();
        }
    }

    numBuildings(height = 0) {
        if (!this.buildings[height]) {
            return 0;
        }
        return this.buildings[height].length;
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
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { Entity } from './entity';
import { InfoBox } from './info_box';
import { Inventory } from './inventory';

const WORLD_Z = new THREE.Vector3(0, 0, 1);
export class Building {
    constructor(Farm, idx, x, z, type, side) {
        this.Farm = Farm;
        this.idx = idx;
        this.pos = new THREE.Vector3(x, 0, z);
        this.type = type;
        this.name = "Building_" + this.idx;
        this.size = this.Farm.BUILDINGS[this.type].size;
        this.side = side;
        this.variation = 0;
        this.foundationBlocks = [];
        this.infoable = this.Farm.BUILDINGS[this.type].infoable;
        this.importTargets = [];
        this.exportTargets = [];
        this.curExportTargets = 0;

        if (!this.size) {
            this.size = { x: 1, z: 1 };
        }

        if (this.Farm.BUILDINGS[this.type].groundStateMutator) {
            let curBlock = this.Farm.blocks[this.pos.x + ',' + this.pos.z];
            curBlock.updateGroundState(this.Farm.BUILDINGS[this.type].groundStateMutator[0], this.side, false);
        } else if (this.Farm.BUILDINGS[this.type].instanced) {
            this.instanced = true;
            this.updateInstancedMesh();
        } else {
            this.mesh = this.Farm.BUILDINGS[this.type].meshes[this.variation].clone();
            this.mesh.owner = this;
            this.mesh.name = this.name;
            if (this.infoable) {
                Farm.groupInfoable.add(this.mesh);
            } else {
                Farm.groupNonInfoable.add(this.mesh);
            }
            this.mesh.rotateY(-(this.side - 1) * Math.PI / 2);
        }

        if (this.Farm.BUILDINGS[this.type].inventorySlots) {
            this.inventory = new Inventory(this.Farm.BUILDINGS[this.type].inventorySlots);
        }

        this.center = {
            x: (this.pos.x + this.size.x * 0.5 - 0.5) * this.Farm.blockSize,
            z: (this.pos.z + this.size.z * 0.5 - 0.5) * this.Farm.blockSize
        };

        this.centerBlock = {
            x: Math.floor(this.center.x / this.Farm.blockSize),
            z: Math.floor(this.center.z / this.Farm.blockSize)
        };

        this.dropOffPoint = this.centerBlock;

        this.childEntities = [];

        if (this.infoable) {
            this.infoBox = new InfoBox(this.Farm, this);
            this.infoBox.addText(this.name);
            this.infoBox.addInventory(this.inventory);
        }

        this.findImportExportTargets();

        this.render();
    }

    findImportExportTargets() {

    }

    getNextExportTarget() {
        for (let i = 0; i < this.exportTargets.length; i++) {
            let tmp = this.curExportTargets % this.exportTargets.length;
            this.curExportTargets = (this.curExportTargets + 1) % this.exportTargets.length;
            if (!this.exportTargets[tmp].inventory.isFull()) {
                return this.exportTargets[tmp];
            }
        }
        return null;
    }

    updateMeshVariation(variation, side = -1) {

        this.variation = variation;
        if (side != -1) {
            this.side = side;
        }
        if (this.Farm.BUILDINGS[this.type].groundStateMutator) {
            let curBlock = this.Farm.blocks[this.pos.x + ',' + this.pos.z];
            curBlock.updateGroundState(this.Farm.BUILDINGS[this.type].groundStateMutator[variation % 6], this.side, false);
        } else if (this.instanced) {
            this.updateInstancedMesh();
        } else {
            if (this.infoable) {
                this.Farm.groupInfoable.remove(this.mesh);
            } else {
                this.Farm.groupNonInfoable.remove(this.mesh);
            }
            this.mesh = this.Farm.BUILDINGS[this.type].meshes[variation].clone();
            this.mesh.owner = this;
            this.mesh.name = this.name;

            if (this.infoable) {
                this.Farm.groupInfoable.add(this.mesh);
            } else {
                this.Farm.groupNonInfoable.add(this.mesh);
            }
            this.mesh.rotateY(-(this.side - 1) * Math.PI / 2);
        }
    }

    updateInstancedMesh() {

        let Farm = this.Farm;

        const matrix = new THREE.Matrix4();

        let building = Farm.BUILDINGS[this.type];

        for (let m = 0; m < building.meshes.length; m++) {

            let curMesh = building.meshes[m];

            let onCurVariation = 0;

            if (this.variation == m) {
                onCurVariation = 1;
            }

            matrix.makeRotationY(-(this.side - 1) * Math.PI / 2);

            matrix.setPosition(
                this.pos.x * Farm.blockSize,
                0,
                this.pos.z * Farm.blockSize
            );

            matrix.scale(new THREE.Vector3(onCurVariation, onCurVariation, onCurVariation));

            curMesh.setMatrixAt(this.meshIdx, matrix);
        }

        this.Farm.plantTypeAwaitingMeshUpdate.add(this.type);
    }

    showInfoBox() {

        let pos = this.Farm.posToScreenPos(this.Farm.getCenterPoint(this.mesh), this.Farm.camera);

        this.infoBox.updatePosition(pos.x, pos.y);

        this.infoBox.show();
    }

    update() {

    }

    render() {
        if (!this.instanced && this.mesh) {
            //this.mesh.position.set(this.center.x, 0, this.center.z);
            let angle = this.center.x * this.Farm.worldCurvature;
            let radius = this.Farm.worldRadius - 0;
            this.mesh.position.set(-radius * Math.sin(angle), Math.sign(this.Farm.worldCurvature) * (this.Farm.worldRadius - radius * Math.cos(angle)), this.center.z);
            this.mesh.rotation.set(0, -(this.side - 1) * Math.PI / 2, 0);
            this.mesh.rotateOnWorldAxis(WORLD_Z, angle);
            if (this.infoable) {
                this.infoBox.render();
            }
        }
    }

    remove() {
        for (let child of this.childEntities) {
            child.remove();
        }

        for (let target of this.exportTargets) {
            if (target.importTargets) {
                target.importTargets.splice(target.importTargets.indexOf(this), 1);
            }
        }
        for (let target of this.importTargets) {
            if (target.exportTargets) {
                target.exportTargets.splice(target.exportTargets.indexOf(this), 1);
            }
        }

        if (this.infoable) {
            this.infoBox.remove();
        }

        if (this.Farm.BUILDINGS[this.type].groundStateMutator) {
            let curBlock = this.Farm.blocks[this.pos.x + ',' + this.pos.z];
            curBlock.updateGroundState(0, 0, false);
        } else if (this.instanced) {

        } else {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            if (this.infoable) {
                this.Farm.groupInfoable.remove(this.mesh);
            } else {
                this.Farm.groupNonInfoable.remove(this.mesh);
            }
        }

        if (this.Farm.buildings[this.idx] == this) {
            delete this.Farm.buildings[this.idx];
            delete this.Farm.updatableBuildings[this.idx];
        }

        this.isRemoved = true;
    }
}

export class BuildingWorkersHouse extends Building {
    constructor(Farm, idx, x, z, type, side, createEntities = true) {
        super(Farm, idx, x, z, type, side);

        this.canExportToStorage = true;

        this.infoBox.addButton("Set Storage", () => {
            console.log("ooo");
        });

        if (createEntities) {
            for (let entityType of this.Farm.BUILDINGS[this.type].entities) {
                let workerEntity = new Entity(Farm, this.Farm.entityIdx, this.center.x, this.center.z, entityType);
                workerEntity.parentBuilding = this;
                this.childEntities.push(workerEntity);
                this.Farm.entities[this.Farm.entityIdx] = workerEntity;
                this.Farm.entityIdx++;
            }
        }
    }

    findImportExportTargets() {
        for (let x = this.pos.x - 10; x <= this.pos.x + 10; x++) {
            for (let z = this.pos.z - 10; z <= this.pos.z + 10; z++) {
                let curBlock = this.Farm.blocks[x + ',' + z];
                if (typeof curBlock === 'undefined') continue;

                for (let curBuilding of curBlock.buildings) {
                    if (curBuilding.isStorage) {
                        if (!curBuilding.importTargets.includes(this)) {
                            curBuilding.importTargets.push(this);
                        }
                        if (!this.exportTargets.includes(curBuilding)) {
                            this.exportTargets.push(curBuilding);
                        }
                    }
                }
            }
        }
        if (Math.abs(this.Farm.restaurantObj.dropOffPoint.x - this.pos.x) <= 100 && Math.abs(this.Farm.restaurantObj.dropOffPoint.z - this.pos.z) <= 100) {
            if (!this.exportTargets.includes(this.Farm.restaurantObj)) {
                this.exportTargets.push(this.Farm.restaurantObj);
            }
        }
    }
}

export class Storage extends Building {
    constructor(Farm, idx, x, z, type, side) {
        super(Farm, idx, x, z, type, side);

        this.isStorage = true;

        this.inventory.onChange = () => {
            let level = this.inventory.getFillLevel() * (this.Farm.BUILDINGS[this.type].meshes.length - 1);
            this.updateMeshVariation(Math.ceil(level));
        };
    }

    findImportExportTargets() {
        for (let x = this.pos.x - 10; x <= this.pos.x + 10; x++) {
            for (let z = this.pos.z - 10; z <= this.pos.z + 10; z++) {
                let curBlock = this.Farm.blocks[x + ',' + z];
                if (typeof curBlock === 'undefined') continue;

                for (let curBuilding of curBlock.buildings) {
                    if (curBuilding.canExportToStorage) {
                        if (!this.importTargets.includes(curBuilding)) {
                            this.importTargets.push(curBuilding);
                        }
                        if (!curBuilding.exportTargets.includes(this)) {
                            curBuilding.exportTargets.push(this);
                        }
                    }
                }
            }
        }
    }
}

export class BuildingWall extends Building {
    constructor(Farm, idx, x, z, type, side) {
        super(Farm, idx, x, z, type, side);

        this.isWall = true;
    }
}

export class BuildingPath extends Building {
    constructor(Farm, idx, x, z, type, side) {
        super(Farm, idx, x, z, type, side);

        this.isPath = true;
    }
}

export class BuildingConnectible extends Building {
    constructor(Farm, idx, x, z, type, side) {
        super(Farm, idx, x, z, type, side);

        this.isConnectible = true;
    }
}

const quad_normals = [
    0, 1, 0
];


/*
      ____
     | 1  |
 ____|____|____
| 4  | 0  | 2  |
|____|____|____|
     | 3  |
     |____|

*/
const waterCenterOffset = 0.3334;
const waterQuads = [];
// Quad 0
waterQuads.push(waterCenterOffset, 0, waterCenterOffset);
waterQuads.push(waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, waterCenterOffset);
// Quad 1
waterQuads.push(1, 0, waterCenterOffset);
waterQuads.push(1, 0, -waterCenterOffset);
waterQuads.push(waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(waterCenterOffset, 0, waterCenterOffset);
// Quad 2
waterQuads.push(waterCenterOffset, 0, 1);
waterQuads.push(waterCenterOffset, 0, waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, 1);
// Quad 3
waterQuads.push(-waterCenterOffset, 0, waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(-1, 0, -waterCenterOffset);
waterQuads.push(-1, 0, waterCenterOffset);
// Quad 4
waterQuads.push(waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(waterCenterOffset, 0, -1);
waterQuads.push(-waterCenterOffset, 0, -1);
waterQuads.push(-waterCenterOffset, 0, -waterCenterOffset);

// Water Level Scale
export const maxWaterDepth = 16;
const waterLevelScale = 1.01 / maxWaterDepth * 2.5 * 0.5;

export class BuildingWaterCarrier extends BuildingConnectible {
    constructor(Farm, idx, x, z, type, side) {
        super(Farm, idx, x, z, type, side);

        this.isWaterCarrier = true;

        this.Farm.waterUpdateList[x + ',' + z] = this;

        this.waterLevels = [maxWaterDepth, maxWaterDepth, maxWaterDepth, maxWaterDepth, maxWaterDepth];

        this.waterVertices = [];
        this.waterNormals = [];
        this.waterIndices = [];
        for (let i = 0; i < waterQuads.length; i += 3) {
            this.waterVertices.push((waterQuads[i + 0] * 0.5 + x) * this.Farm.blockSize);
            this.waterVertices.push(waterQuads[i + 1]);
            this.waterVertices.push((waterQuads[i + 2] * 0.5 + z) * this.Farm.blockSize);
        }

        for (let i = 0; i < 5; i++) {
            this.waterNormals.push(...quad_normals);
            this.waterNormals.push(...quad_normals);
            this.waterNormals.push(...quad_normals);
            this.waterNormals.push(...quad_normals);
            let curIdx = i * 4;
            this.waterIndices.push(curIdx + 0);
            this.waterIndices.push(curIdx + 1);
            this.waterIndices.push(curIdx + 2);
            this.waterIndices.push(curIdx + 0);
            this.waterIndices.push(curIdx + 2);
            this.waterIndices.push(curIdx + 3);
        }

        this.waterGeometry = new THREE.BufferGeometry();
        this.waterGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.waterVertices), 3));
        //this.waterGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.waterNormals), 3));
        this.waterGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(this.waterIndices), 1));

        let waterMaterial = new THREE.MeshLambertMaterial({
            color: 0x2e93d9
        });

        this.waterMesh = new THREE.Mesh(this.waterGeometry, waterMaterial);

        this.waterMesh.receiveShadow = true;

        this.Farm.scene.add(this.waterMesh);

        this.updateWaterMesh();
    }

    remove() {

        this.waterMesh.geometry.dispose();
        this.waterMesh.material.dispose();
        this.Farm.scene.remove(this.waterMesh);

        delete this.Farm.waterUpdateList[this.pos.x + ',' + this.pos.z];

        super.remove();
    }

    updateWaterMesh() {
        for (let i = 0; i < this.waterLevels.length; i++) {
            for (let j = 0; j < 4; j++) {
                if (Math.abs(waterQuads[i * 12 + j * 3 + 0]) == 1 || Math.abs(waterQuads[i * 12 + j * 3 + 2]) == 1) {
                    if (this.waterLevels[i] == -1) {
                        this.waterVertices[i * 12 + j * 3 + 1] = -10;
                    } else {
                        this.waterVertices[i * 12 + j * 3 + 1] = 0 - this.waterLevels[i] * waterLevelScale;
                    }
                } else {
                    this.waterVertices[i * 12 + j * 3 + 1] = 0 - this.waterLevels[0] * waterLevelScale;
                }
            }
        }
        this.waterGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.waterVertices), 3));
        this.waterGeometry.computeVertexNormals();
    }
}
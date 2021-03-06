import * as THREE from './three/src/Three';
import * as SkeletonUtils from './three_utils/SkeletonUtils';
import { Entity } from './entity';
import { InfoBox } from './info_box';
import { Inventory } from './inventory';
import { Livestock } from './livestock';
import { updateEntityMesh } from './update_instanced_meshes';

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

        this.matrix = new THREE.Matrix4();

        if (!this.size) {
            this.size = { x: 1, z: 1 };
        }

        if (this.Farm.BUILDINGS[this.type].groundStateMutator) {
            this.groundStateMutator = true;
            let curBlock = this.Farm.blocks[this.pos.x + ',' + this.pos.z];
            curBlock.updateGroundState(this.Farm.BUILDINGS[this.type].groundStateMutator[0], this.side, false);
        }

        if (this.Farm.BUILDINGS[this.type].noMesh) {
            this.noMesh = true;
        } else if (this.Farm.BUILDINGS[this.type].instanced) {
            this.instanced = true;
            this.updateInstancedMesh();
        } else {
            this.mesh = this.Farm.BUILDINGS[this.type].meshes[this.variation].clone();

            // Set up animations
            if (this.Farm.BUILDINGS[this.type].animations[this.variation].length > 0) {

                this.mesh = SkeletonUtils.clone(this.Farm.BUILDINGS[this.type].meshes[this.variation]);

                this.mixer = new THREE.AnimationMixer(this.mesh);
                this.mixer.clipAction(this.Farm.BUILDINGS[this.type].animations[this.variation][0]).play();
                this.Farm.mixers[this.name] = this.mixer;
            }

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

        let centerOffsetX = 0;
        let centerOffsetZ = 0;

        if (this.Farm.BUILDINGS[this.type].center) {
            if (this.Farm.buildBuildingSide == 3) {
                centerOffsetX = this.Farm.BUILDINGS[this.type].center.x;
                centerOffsetZ = this.Farm.BUILDINGS[this.type].center.z;
            } else if (this.Farm.buildBuildingSide == 2) {
                centerOffsetX = this.Farm.BUILDINGS[this.type].center.z;
                centerOffsetZ = -this.Farm.BUILDINGS[this.type].center.x;
            } else if (this.Farm.buildBuildingSide == 1) {
                centerOffsetX = -this.Farm.BUILDINGS[this.type].center.x;
                centerOffsetZ = -this.Farm.BUILDINGS[this.type].center.z;
            } else {
                centerOffsetX = -this.Farm.BUILDINGS[this.type].center.z;
                centerOffsetZ = this.Farm.BUILDINGS[this.type].center.x;
            }
        }

        let otherSideX = 0;
        let otherSideZ = 0;

        if (this.side == 3) {
            otherSideX = this.size.x - 1;
            otherSideZ = this.size.z - 1;
        } else if (this.side == 2) {
            otherSideX = this.size.z - 1;
            otherSideZ = -this.size.x + 1;
        } else if (this.side == 1) {
            otherSideX = -this.size.x + 1;
            otherSideZ = -this.size.z + 1;
        } else {
            otherSideX = -this.size.z + 1;
            otherSideZ = this.size.x - 1;
        }

        this.center = {
            x: (this.pos.x + centerOffsetX + otherSideX * 0.5) * this.Farm.blockSize,
            y: 0,
            z: (this.pos.z + centerOffsetZ + otherSideZ * 0.5) * this.Farm.blockSize
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
        }
        if (this.noMesh) {

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

        let building = Farm.BUILDINGS[this.type];

        for (let m = 0; m < building.meshes.length; m++) {

            let curMesh = building.meshes[m];

            let onCurVariation = 0;

            if (this.variation == m) {
                onCurVariation = 1;
            }

            this.matrix.makeRotationY(-(this.side - 1) * Math.PI / 2);

            this.matrix.setPosition(
                this.pos.x * Farm.blockSize,
                this.pos.y * Farm.blockSize * 0.5,
                this.pos.z * Farm.blockSize
            );

            this.matrix.scale(new THREE.Vector3(onCurVariation, onCurVariation, onCurVariation));

            curMesh.setMatrixAt(this.meshIdx, this.matrix);
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
            this.mesh.position.set(this.center.x, 0, this.center.z);
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
        }
        if (this.noMesh) {

        } else if (this.instanced) {

        } else {

            if (this.infoable) {
                this.Farm.groupInfoable.remove(this.mesh);
            } else {
                this.Farm.groupNonInfoable.remove(this.mesh);
            }

            if (this.Farm.BUILDINGS[this.type].animations[this.variation].length > 0) {
                this.mesh.children[1].geometry.dispose();
                this.mesh.children[1].material.dispose();
            } else {
                this.mesh.geometry.dispose();
                this.mesh.material.dispose();
            }
        }

        if (this.Farm.buildings[this.idx] == this) {
            delete this.Farm.buildings[this.idx];
            delete this.Farm.updatableBuildings[this.idx];
            delete this.Farm.mixers[this.name];
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

                for (let height in curBlock.buildings) {
                    for (let curBuilding of curBlock.buildings[height]) {
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

                for (let height in curBlock.buildings) {
                    for (let curBuilding of curBlock.buildings[height]) {
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
}

export class BuildingBarn extends Building {
    constructor(Farm, idx, x, z, type, side, createEntities = true) {
        super(Farm, idx, x, z, type, side);

        if (createEntities) {
            for (let entityType of this.Farm.BUILDINGS[this.type].entities) {
                let workerEntity = new Livestock(Farm, this.Farm.entityIdx, this.center.x, this.center.z, entityType);
                workerEntity.parentBuilding = this;
                this.childEntities.push(workerEntity);
                this.Farm.entities[this.Farm.entityIdx] = workerEntity;
                this.Farm.entityIdx++;
            }
            updateEntityMesh(this.Farm, this.Farm.BUILDINGS[this.type].entities[0]);
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

        this.waterDirection = -1;
        this.waterLevels = [maxWaterDepth, maxWaterDepth, maxWaterDepth, maxWaterDepth, maxWaterDepth];

        this.waterPosition = 0;

        this.connectibleGroup = this.Farm.BUILDINGS[this.type].connectibleGroup;
        this.leaky = this.Farm.BUILDINGS[this.type].leaky;

        if (this.connectibleGroup == "aquaduct") {
            this.waterPosition = 5;
        }

        this.waterMeshIdx = -1;
    }

    remove() {

        /*this.waterMesh.geometry.dispose();
        this.waterMesh.material.dispose();
        this.Farm.scene.remove(this.waterMesh);*/

        delete this.Farm.waterUpdateList[this.pos.x + ',' + this.pos.z];

        super.remove();
    }

    updateWaterMesh() {

        if (this.waterMeshIdx == -1) return;

        let arr = this.Farm.waterVerticesBufferAttribute.array;

        for (let i = 0; i < this.waterLevels.length; i++) {
            for (let j = 0; j < 4; j++) {
                let quadIdx = i * 12 + j * 3;
                let idx = quadIdx + this.waterMeshIdx * 60;
                arr[idx + 0] = (waterQuads[quadIdx + 0] * 0.5 + this.pos.x) * this.Farm.blockSize;
                arr[idx + 2] = (waterQuads[quadIdx + 2] * 0.5 + this.pos.z) * this.Farm.blockSize;
                if (Math.abs(waterQuads[quadIdx + 0]) == 1 || Math.abs(waterQuads[quadIdx + 2]) == 1) {
                    if (this.waterLevels[i] == -1 || this.waterLevels[i] >= maxWaterDepth) {
                        arr[idx + 0] = (this.pos.x) * this.Farm.blockSize;
                        arr[idx + 2] = (this.pos.z) * this.Farm.blockSize;
                        arr[idx + 1] = this.waterPosition - 1.5;
                    } else {
                        arr[idx + 1] = this.waterPosition - this.waterLevels[i] * waterLevelScale;
                    }
                } else {
                    arr[idx + 1] = this.waterPosition - this.waterLevels[0] * waterLevelScale;
                }
            }
        }

        this.Farm.waterVerticesBufferAttributeNeedsUpdate = true;
        //this.Farm.waterGeometry.computeVertexNormals();
    }
}
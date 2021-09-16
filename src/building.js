import * as THREE from 'three';
import { TextureLoader } from 'three';
import { Entity } from './entity';
import { InfoBox } from './info_box';

export class Building {
    constructor(Farm, x, z, type, side, name = null) {
        this.Farm = Farm;
        this.pos = new THREE.Vector3(x, 0, z);
        this.type = type;
        this.name = name;

        this.mesh = this.Farm.BUILDINGS[this.type].meshes[0].clone();
        this.size = this.Farm.BUILDINGS[this.type].size;
        this.mesh.owner = this;
        Farm.groupInfoable.add(this.mesh);

        this.center = {
            x: (this.pos.x + this.size.x * 0.5 - 0.5) * this.Farm.blockSize,
            z: (this.pos.z + this.size.z * 0.5 - 0.5) * this.Farm.blockSize
        };

        this.centerBlock = {
            x: Math.floor(this.center.x / this.Farm.blockSize),
            z: Math.floor(this.center.z / this.Farm.blockSize)
        };

        this.side = side;
        this.mesh.rotateY(-(this.side - 1) * Math.PI / 2);

        this.childEntities = [];

        this.infoBox = new InfoBox(this.Farm, this);
        this.infoBox.addText("Building");
    }

    showInfoBox() {

        let pos = this.Farm.posToScreenPos(this.Farm.getCenterPoint(this.mesh), this.Farm.camera);

        this.infoBox.updatePosition(pos.x, pos.y);

        this.infoBox.show();
    }

    update() {

    }

    render() {
        if (this.mesh) {
            this.mesh.position.set(this.center.x, 0, this.center.z);
            this.infoBox.render();
        }
    }

    remove() {
        for (let child of this.childEntities) {
            child.remove();
        }

        this.infoBox.remove();

        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.Farm.groupInfoable.remove(this.mesh);

        let idx = this.Farm.buildings.indexOf(this);
        this.Farm.buildings[idx] = null;

        this.isRemoved = true;
    }
}

export class BuildingWorkersHouse extends Building {
    constructor(Farm, x, z, type, side, name = null) {
        super(Farm, x, z, type, side, name);

        for (let entityType of this.Farm.BUILDINGS[this.type].entities) {
            let workerEntity = new Entity(Farm, this.center.x, this.center.z, entityType);
            workerEntity.parentBuilding = this;
            this.childEntities.push(workerEntity);
            this.Farm.entities.push(workerEntity);
        }
    }
}

export class BuildingWall extends Building {
    constructor(Farm, x, z, type, side, name = null) {
        super(Farm, x, z, type, side, name);

        this.isWall = true;
    }
}

export class BuildingPath extends Building {
    constructor(Farm, x, z, type, side, name = null) {
        super(Farm, x, z, type, side, name);

        this.isPath = true;
    }
}
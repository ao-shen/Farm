import * as THREE from 'three';
import { TextureLoader } from 'three';
import { Entity } from './entity';

export class Building {
    constructor(Farm, x, z, type, side, name = null) {
        this.Farm = Farm;
        this.pos = new THREE.Vector3(x, 0, z);
        this.type = type;
        this.name = name;

        this.mesh = this.Farm.BUILDINGS[this.type].meshes[0].clone();
        Farm.scene.add(this.mesh);

        this.side = side;
        this.mesh.rotateY(-(this.side - 1) * Math.PI / 2);

        this.childEntities = [];
    }

    update() {

    }

    render() {
        if (this.mesh) {
            this.mesh.position.set(this.pos.x * this.Farm.blockSize, 0, this.pos.z * this.Farm.blockSize);
        }
    }

    remove() {
        for (let child of this.childEntities) {
            child.remove();
        }

        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.Farm.scene.remove(this.mesh);

        let idx = this.Farm.buildings.indexOf(this);
        this.Farm.buildings[idx] = null;

        this.isRemoved = true;
    }
}

export class BuildingWorkersHouse extends Building {
    constructor(Farm, x, z, type, side, name = null) {
        super(Farm, x, z, type, side, name);

        for (let entityType of this.Farm.BUILDINGS[this.type].entities) {
            let workerEntity = new Entity(Farm, x, z, entityType);
            workerEntity.parentBuilding = this;
            this.childEntities.push(workerEntity);
            this.Farm.entities.push(workerEntity);
        }
    }

    update() {
        super.update();
    }

    render() {
        super.render();
    }
}

export class BuildingWall extends Building {
    constructor(Farm, x, z, type, side, name = null) {
        super(Farm, x, z, type, side, name);

        this.isWall = true;
    }

    update() {
        super.update();
    }

    render() {
        super.render();
    }
}
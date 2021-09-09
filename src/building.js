import * as THREE from 'three';

export class Building {
    constructor(Farm, x, z, type, name = null) {
        this.Farm = Farm;
        this.pos = new THREE.Vector3(x, 0, z);
        this.type = type;
        this.name = name;

        this.mesh = this.Farm.BUILDINGS[this.type].meshes[0].clone();
        Farm.scene.add(this.mesh);
    }

    update() {

    }

    render() {
        if (this.mesh) {
            this.mesh.position.set(this.pos.x * this.Farm.blockSize, 0, this.pos.z * this.Farm.blockSize);
        }
    }
}

export class BuildingWorkersHouse extends Building {
    constructor(Farm, x, z, type, name = null) {
        super(Farm, x, z, type, name);
    }

    update() {
        super.update();
    }

    render() {
        super.render();
    }
}
import * as THREE from 'three';
import { Vector2 } from 'three';
import { Text } from 'troika-three-text';
import { NineSlicePlane } from './nine_slice';

const TEXT = 0;
const INVENTORY = 1;

export class InfoBox {
    constructor(Farm, owner, ownerMeshProperty = "mesh") {

        this.Farm = Farm;
        this.owner = owner;
        this.ownerMeshProperty = ownerMeshProperty;

        this.name = "InfoBox_" + owner.name;

        this.width = 200;
        this.height = 300;

        this.pos = new Vector2();

        this.meshBackground = new NineSlicePlane(Farm.materialInfoBoxBackground, {
            width: this.width,
            height: this.height,
            border: 10
        });

        this.meshBackground.name = this.name;

        this.showing = false;

        let geometry = new THREE.BufferGeometry();

        let lineVertices = [0, 0, 0, 0, 0, 0, 0, 0, 0];

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));

        let material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, linewidth: 3 });

        this.lineMesh = new THREE.Line(geometry, material);

        this.infos = [];
    }

    addText(text) {
        let textMesh = new Text();
        textMesh.text = text;
        textMesh.fontSize = 24;
        textMesh.color = 0xFFFFFF;
        textMesh.name = this.name;
        this.meshBackground.add(textMesh);

        this.infos.push({ type: TEXT, mesh: textMesh });
    }

    addInventory(inventory) {

        let textMesh = new Text();
        textMesh.text = "Inventory";
        textMesh.fontSize = 24;
        textMesh.color = 0xFFFFFF;
        textMesh.name = this.name;
        this.meshBackground.add(textMesh);

        this.infos.push({ type: INVENTORY, inventory: inventory, mesh: textMesh });
    }

    updatePosition(x, y) {

        if (x > 0) {
            x += 200;
        } else {
            x -= 200;
        }
        y += 50;

        if (x - this.width / 2 < -window.innerWidth / 2) {
            x = -window.innerWidth / 2 + this.width / 2;
        }
        if (x + this.width / 2 > +window.innerWidth / 2) {
            x = +window.innerWidth / 2 - this.width / 2;
        }
        if (y - this.height / 2 < -window.innerHeight / 2) {
            y = -window.innerHeight / 2 + this.height / 2;
        }
        if (y + this.height / 2 > +window.innerHeight / 2) {
            y = +window.innerHeight / 2 - this.height / 2;
        }

        this.pos.set(x, y);
    }

    render() {
        if (this.showing) {

            let curXOffset = -this.width / 2 + 10;
            let curYOffset = +this.height / 2 - 10;
            for (let info of this.infos) {
                let mesh = info.mesh;
                switch (info.type) {
                    case TEXT:
                        mesh.position.set(curXOffset, curYOffset, 1);
                        curYOffset -= 30;
                        break;
                    case INVENTORY:
                        mesh.position.set(curXOffset, curYOffset, 1);
                        let str = "Inventory:\n";
                        curYOffset -= 30;
                        for (let type in info.inventory.inventory) {
                            str += this.owner.Farm.BUILDINGS[type].name + " x" + info.inventory.inventory[type] + "\n";
                            curYOffset -= 30;
                        }
                        mesh.text = str;

                        break;
                }
            }

            this.meshBackground.position.set(this.pos.x, this.pos.y, -50);

            let pos = this.Farm.posToScreenPos(this.Farm.getCenterPoint(this.owner[this.ownerMeshProperty]), this.Farm.camera);

            let lineVertices = [pos.x, pos.y, -51];

            /*if (pos.y < this.pos.y) {
                if (pos.x < this.pos.x) {
                    lineVertices.push(pos.x - (pos.y - this.pos.y), this.pos.y, -51);
                } else {
                    lineVertices.push(pos.x + (pos.y - this.pos.y), this.pos.y, -51);
                }
            } else {
                if (pos.x < this.pos.x) {
                    lineVertices.push(pos.x + (pos.y - this.pos.y), this.pos.y, -51);
                } else {
                    lineVertices.push(pos.x - (pos.y - this.pos.y), this.pos.y, -51);
                }
            }*/
            if (pos.x < this.pos.x) {
                lineVertices.push(this.pos.x - 120, this.pos.y, -51);
            } else {
                lineVertices.push(this.pos.x + 120, this.pos.y, -51);
            }

            lineVertices.push(this.pos.x, this.pos.y, -51);

            this.lineMesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
        }
    }

    show() {
        this.showing = true;
        this.Farm.visibleInfoBoxes.push(this);

        this.Farm.hudScene.add(this.meshBackground);
        this.Farm.hudScene.add(this.lineMesh);
    }

    hide() {
        this.showing = false;
        var index = this.Farm.visibleInfoBoxes.indexOf(this);
        if (index !== -1) {
            this.Farm.visibleInfoBoxes.splice(index, 1);
        }

        this.Farm.hudScene.remove(this.meshBackground);
        this.Farm.hudScene.remove(this.lineMesh);
    }

    toggle() {
        if (this.showing) {
            this.hide();
        } else {
            this.show();
        }
    }

    remove() {

        if (this.showing) {
            this.hide();
        }

        for (let info of this.infos) {
            this.meshBackground.remove(info.mesh);
            info.mesh.dispose();
        }

        this.meshBackground.geometry.dispose();

        this.isRemoved = true;
    }
}
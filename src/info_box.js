import * as THREE from 'three';
import { NineSlicePlane } from './nine_slice';

export class InfoBox {
    constructor(Farm) {

        this.Farm = Farm;

        this.width = 200;
        this.height = 600;

        this.meshBackground = new NineSlicePlane(Farm.materialInfoBoxBackground, {
            width: this.width,
            height: this.height,
            border: 10
        });

        this.showing = false;

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


        this.meshBackground.position.set(x, y, -50);
    }

    show() {
        this.showing = true;
        this.Farm.visibleInfoBoxes.push(this);

        this.Farm.hudScene.add(this.meshBackground);
    }

    hide() {
        this.showing = false;
        var index = this.Farm.visibleInfoBoxes.indexOf(this);
        if (index !== -1) {
            this.Farm.visibleInfoBoxes.splice(index, 1);
        }

        this.Farm.hudScene.remove(this.meshBackground);
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

        this.meshBackground.geometry.dispose();

        this.isRemoved = true;
    }
}
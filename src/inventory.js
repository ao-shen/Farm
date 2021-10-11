import { cloneDeep } from 'lodash';

var randomKey = function(obj) {
    var keys = Object.keys(obj);
    return keys[keys.length * Math.random() << 0];
};

export class Inventory {

    constructor(slots, onChange = () => {}) {
        this.slots = slots;
        this.slotsFilled = 0;
        this.inventory = {};

        this.onChange = onChange;
    }

    add(type, amount = 1, force = false, triggerOnChange = true) {
        if (this.inventory[type]) {} else {
            this.inventory[type] = 0;
        }
        this.inventory[type] += amount;
        this.slotsFilled += amount;
        if (force) {
            if (triggerOnChange) this.onChange();
            return 0;
        }
        if (this.slotsFilled > this.slots) {
            let leftover = this.slotsFilled - this.slots;
            this.inventory[type] -= leftover;
            this.slotsFilled -= leftover;
            if (triggerOnChange) this.onChange();
            return leftover;
        } else {
            if (triggerOnChange) this.onChange();
            return 0;
        }
    }

    addMultiple(transaction) {
        for (let type in transaction) {
            this.add(type, transaction[type], true, false);
        }
        this.onChange();
    }

    remove(type, amount = 1, triggerOnChange = true) {
        if (this.inventory[type]) {
            if (this.inventory[type] >= amount) {
                this.inventory[type] -= amount;
                this.slotsFilled -= amount;
                if (this.inventory[type] <= 0) {
                    delete this.inventory[type];
                }
                if (triggerOnChange) this.onChange();
                return amount;
            } else {
                let actualAmount = this.inventory[type];
                delete this.inventory[type];
                this.slotsFilled -= actualAmount;
                if (triggerOnChange) this.onChange();
                return actualAmount;
            }
        } else {
            if (triggerOnChange) this.onChange();
            return 0;
        }
    }

    removeRandom(amount = 1) {
        let removedInventory = {};
        for (let i = 0; i < amount && this.getFillLevel() > 0; i++) {
            let type = randomKey(this.inventory);
            removedInventory[type] = this.remove(type);
        }
        return removedInventory;
    }

    transferTo(other, transaction) {
        let total = 0;
        for (let type in transaction) {

            let leftover = other.add(type, this.remove(type, transaction[type], false))

            total += transaction[type] - leftover;

            if (leftover > 0) {
                this.add(type, leftover, true, false);
                break;
            }
        }

        this.onChange();
        return total;
    }

    transferAllTo(other) {
        return this.transferTo(other, cloneDeep(this.inventory));
    }

    isFull() {
        return this.slots <= this.slotsFilled;
    }

    isEmpty() {
        return this.slotsFilled == 0;
    }

    getFillLevel() {
        return this.slotsFilled / this.slots;
    }

    getSlotsFilled() {
        return this.slotsFilled;
    }
}
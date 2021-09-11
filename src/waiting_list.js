export class WaitingList {
    constructor() {
        this.chunks = [];
    }

    init(Farm) {
        for (let i = 0; i < Farm.numBlocks.x; i++) {
            this.chunks.push([]);
        }
    }

    add(pos, obj) {
        let chunkIdx = pos.x;
        let curChunk = this.chunks[chunkIdx];

        let newIdx = sortedIndex(curChunk, pos);

        curChunk.splice(newIdx, 0, { pos: pos, obj: obj });
    }

    remove(pos, obj) {
        let chunkIdx = pos.x;
        let curChunk = this.chunks[chunkIdx];

        let newIdx = sortedIndex(curChunk, pos);

        while (newIdx < curChunk.length && curChunk[newIdx].obj != obj) {
            newIdx++;
        }

        if (newIdx == curChunk.length) {
            return;
        }

        curChunk.splice(newIdx, 1);
    }

    findNearest(pos, limit = -1) {
        let l = pos.x - 1;
        let r = pos.x;
        let curIdx, newIdx;

        let nearest = null;
        let gettingCloser = true;

        while (gettingCloser && (l >= 0 || r < this.chunks.length)) {

            gettingCloser = false;

            if ((nearest == null || nearest.dist > r - pos.x) && (limit == -1 || limit >= r - pos.x)) {
                gettingCloser = true;
                if (r < this.chunks.length) {
                    curIdx = sortedIndex(this.chunks[r], pos);
                    if (curIdx > 0) {
                        newIdx = curIdx - 1;
                        let newDist = chebyshevDist(this.chunks[r][newIdx].pos, pos);
                        if ((limit == -1 || limit >= newDist) && (nearest == null || nearest.dist > newDist)) {
                            nearest = { element: this.chunks[r][newIdx], dist: newDist };
                        }
                    }
                    if (curIdx < this.chunks[r].length) {
                        newIdx = curIdx;
                        let newDist = chebyshevDist(this.chunks[r][newIdx].pos, pos);
                        if ((limit == -1 || limit >= newDist) && (nearest == null || nearest.dist > newDist)) {
                            nearest = { element: this.chunks[r][newIdx], dist: newDist };
                        }
                    }
                }
                r++;
            }
            if ((nearest == null || nearest.dist > pos.x - l) && (limit == -1 || limit >= pos.x - l)) {
                gettingCloser = true;
                if (l >= 0) {
                    curIdx = sortedIndex(this.chunks[l], pos);
                    if (curIdx > 0) {
                        newIdx = curIdx - 1;
                        let newDist = chebyshevDist(this.chunks[l][newIdx].pos, pos);
                        if ((limit == -1 || limit >= newDist) && (nearest == null || nearest.dist > newDist)) {
                            nearest = { element: this.chunks[l][newIdx], dist: newDist };
                        }
                    }
                    if (curIdx < this.chunks[l].length) {
                        newIdx = curIdx;
                        let newDist = chebyshevDist(this.chunks[l][newIdx].pos, pos);
                        if ((limit == -1 || limit >= newDist) && (nearest == null || nearest.dist > newDist)) {
                            nearest = { element: this.chunks[l][newIdx], dist: newDist };
                        }
                    }
                }
                l--;
            }
        }
        return nearest;
    }
}

function sortedIndex(array, value) {
    var low = 0,
        high = array.length;

    while (low < high) {
        var mid = (low + high) >>> 1;
        if (array[mid].pos.z < value.z) low = mid + 1;
        else high = mid;
    }
    return low;
}

function chebyshevDist(goal, pos) {
    let distX = Math.abs(pos.x - goal.x);
    let distZ = Math.abs(pos.z - goal.z);
    let min = Math.min(distX, distZ);
    let max = Math.max(distX, distZ);
    return max - min + min * 1.414;
}
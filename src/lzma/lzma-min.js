let lzma_worker = new Worker("../src/lzma/lzma_worker-min.js");
let callback_obj = {};
var action_compress = 1,
    action_decompress = 2,
    action_progress = 3;

LZMA_init();

function LZMA_init() {

    lzma_worker.onmessage = function onmessage(e) {
        if (e.data.action === action_progress) {
            if (callback_obj[e.data.cbn] && typeof callback_obj[e.data.cbn].on_progress === "function") {
                callback_obj[e.data.cbn].on_progress(e.data.result);
            }
        } else {
            if (callback_obj[e.data.cbn] && typeof callback_obj[e.data.cbn].on_finish === "function") {
                callback_obj[e.data.cbn].on_finish(e.data.result, e.data.error);

                /// Since the (de)compression is complete, the callbacks are no longer needed.
                delete callback_obj[e.data.cbn];
            }
        }
    };

    /// Very simple error handling.
    lzma_worker.onerror = function(event) {
        var err = new Error(event.message + " (" + event.filename + ":" + event.lineno + ")");

        for (var cbn in callback_obj) {
            callback_obj[cbn].on_finish(null, err);
        }

        console.error('Uncaught error in lzma_worker', err);
    };
}

function send_to_worker(action, data, mode, on_finish, on_progress) {
    var cbn;

    do {
        cbn = Math.floor(Math.random() * (10000000));
    } while (typeof callback_obj[cbn] !== "undefined");

    callback_obj[cbn] = {
        on_finish: on_finish,
        on_progress: on_progress
    };

    lzma_worker.postMessage({
        action: action, /// action_compress = 1, action_decompress = 2, action_progress = 3
        cbn: cbn, /// callback number
        data: data,
        mode: mode
    });
}

export let LZMA = {
    compress: function compress(mixed, mode, on_finish, on_progress) {
        send_to_worker(action_compress, mixed, mode, on_finish, on_progress);
    },
    decompress: function decompress(byte_arr, on_finish, on_progress) {
        send_to_worker(action_decompress, byte_arr, false, on_finish, on_progress);
    },
    worker: function worker() {
        return lzma_worker;
    }
};
export class Scheduler {
    constructor() {

        this.schedules = {};

        for (const SCHEDULE of SCHEDULES) {

            this.schedules[SCHEDULE.interval] = {
                startTime: (new Date()).getTime(),
                lastInstance: 0,
                instances: [],
                SCHEDULE: SCHEDULE,
            };

            for (let i = 0; i < SCHEDULE.instances; i++) {
                this.schedules[SCHEDULE.interval].instances.push(new Set());
            }
        }
    }

    addToSchedule(interval, callback) {
        let schedule = this.schedules[interval];
        let now = (new Date()).getTime();
        let curInstance = Math.floor((now - schedule.startTime) / (schedule.SCHEDULE.interval / schedule.SCHEDULE.instances)) + 1;
        this.schedules[interval].instances[(curInstance + schedule.SCHEDULE.instances) % schedule.SCHEDULE.instances].add({
            skip: true,
            callback: callback
        });
    }

    onFrame() {
        let now = (new Date()).getTime();
        for (const interval in this.schedules) {
            let schedule = this.schedules[interval];
            let curInstance = Math.floor((now - schedule.startTime) / (schedule.SCHEDULE.interval / schedule.SCHEDULE.instances));

            while (schedule.lastInstance < curInstance) {
                schedule.lastInstance++;

                schedule.instances[schedule.lastInstance % schedule.SCHEDULE.instances].forEach((schedulee) => {
                    if (schedulee.skip) {
                        schedulee.skip = false;
                    } else {
                        if (!schedulee.callback()) {
                            schedule.instances[schedule.lastInstance % schedule.SCHEDULE.instances].delete(schedulee);
                        }
                    }
                })
            }
        }
    }
};

const SCHEDULES = [
    { interval: 100, instances: 2 },
    { interval: 500, instances: 5 },
    { interval: 1000, instances: 10 },
    { interval: 5000, instances: 20 },
    { interval: 10000, instances: 20 },
    { interval: 30000, instances: 30 },
]
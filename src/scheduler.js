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
        let curInstance = Math.floor((now - schedule.startTime) / (schedule.SCHEDULE.interval / schedule.SCHEDULE.instances));
        this.schedules[interval].instances[curInstance % schedule.SCHEDULE.instances].add(callback);
    }

    onFrame() {
        let now = (new Date()).getTime();
        for (const interval in this.schedules) {
            let schedule = this.schedules[interval];
            let curInstance = Math.floor((now - schedule.startTime) / (schedule.SCHEDULE.interval / schedule.SCHEDULE.instances));

            while (schedule.lastInstance < curInstance) {
                schedule.lastInstance++;

                schedule.instances[schedule.lastInstance % schedule.SCHEDULE.instances].forEach((callback) => {
                    if (!callback()) {
                        schedule.instances[schedule.lastInstance % schedule.SCHEDULE.instances].delete(callback);
                    }
                })
            }
        }
    }
};

const SCHEDULES = [
    { interval: 500, instances: 10 },
    { interval: 1000, instances: 10 },
    { interval: 5000, instances: 20 },
    { interval: 10000, instances: 20 },
    { interval: 30000, instances: 30 },
]
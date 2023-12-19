/**
 * Чат ЖПТ представляет
 */
class Cpu {
    /**
     * Создание нагрузки на CPU
     * @param {*} targetLoad 
     */
    constructor(targetLoad) {
        this.loadCPU(targetLoad)
    }

    /**
     * Простое вычисление для создания нагрузки
     * @param {*} duration 
     */
    busyWork(duration) {
        const end = Date.now() + duration;
        while (Date.now() < end) {
            Math.sqrt(Math.random());
        }
    }

    /**
     * Спим
     * @param {*} duration 
     * @returns 
     */
    sleep(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    /**
     * Главная функция для создания нагрузки на CPU
     * @param {*} targetLoad 
     */
    async loadCPU(targetLoad) {
        const loadDuration = 100; // Время в мс, которое мы занимаем CPU
        const totalDuration = (loadDuration / targetLoad) * 100; // Общее время цикла, чтобы достичь целевой нагрузки
        const sleepDuration = totalDuration - loadDuration; // Время в мс, на которое мы "отдыхаем"
        // console.log("totalDuration", totalDuration, "sleepDuration", sleepDuration);
        while (true) {
            const startTime = Date.now();

            // Занимаем CPU
            this.busyWork(loadDuration);

            // Вычисляем, сколько времени прошло и сколько нужно 'отдохнуть'
            const workTime = Date.now() - startTime;
            const remainingSleep = sleepDuration - workTime;

            if (remainingSleep > 0) {
                // Отдыхаем, если осталось время
                await this.sleep(remainingSleep);
            }
        }
    }
}

export default Cpu;
type LoggerLevel = 'INFOS' | 'SUCCESS' | 'ERROR' | 'WARNING' | 'DEBUG';

const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    fg: {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        gray: "\x1b[90m"
    }
};

type ColorKey = keyof typeof COLORS.fg;

const logger = (() => {

    const format = (level: LoggerLevel, color: string, message: string) => {

        const timestamp = new Date().toISOString();
        const prefix = `${COLORS.fg.gray}[${timestamp}]${COLORS.reset} ${COLORS.bright}${color}[${level}]${COLORS.reset}`;
        return `${prefix} ${message}`;
    };

    return Object.freeze({
        info: (msg: string) => {
            console.log(format("INFOS", COLORS.fg.cyan, msg));
        },
        success: (msg: string) => {
            console.log(format("SUCCESS", COLORS.fg.green, msg));
        },
        error: (msg: string) => {
            console.error(format("ERROR", COLORS.fg.red, msg));
        },
        warn: (msg: string) => {
            console.warn(format("WARNING", COLORS.fg.yellow, msg));
        },
        debug: (msg: string) => {
            // Optionnel : n'affiche que si une variable d'env est présente
            if (process.env.DEBUG) {
                console.debug(format("DEBUG", COLORS.fg.magenta, msg));
            }
        },
        paint:(msg:string,color:ColorKey = 'gray') => {
            const prefix = `${COLORS.bright}${COLORS.fg[color]}`
            console.log(prefix,msg,COLORS.reset);
        }
    });
})();


export default logger;
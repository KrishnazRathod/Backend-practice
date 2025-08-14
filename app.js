const logger = require("./logger.js")
const utils = require("./utils.js")

logger.log("Hello World");
const sum = utils.add(1, 2);
const substraction = utils.subtract(1, 2);
logger.log(sum);
logger.log(substraction);

logger.error("This is an error message");
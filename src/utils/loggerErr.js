const format = require("node.date-time");
const fs = require("fs");

function loggerErr(errorComment, err) {
  const logDateTime = new Date().format('D-M-y H:M:S')

  fs.appendFile('logsErr.txt', `${logDateTime} -- ${errorComment} -- ${err.message}\n`);
}

module.exports = {loggerErr};

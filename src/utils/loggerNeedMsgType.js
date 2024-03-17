const format = require("node.date-time");
const fs = require("fs");

function loggerNeedMsgType(protectType) {
  const logDateTime = new Date().format('D-M-y H:M:S')

  fs.appendFile('loggerNeedMsgType.txt', `${logDateTime} -- ${protectType}\n`);
}

module.exports = {loggerNeedMsgType};

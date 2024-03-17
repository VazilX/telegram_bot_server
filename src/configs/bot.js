const TelegramApi = require('node-telegram-bot-api');
const { token } = require('./const');

const bot = new TelegramApi(token, { polling: true });

module.exports = bot;
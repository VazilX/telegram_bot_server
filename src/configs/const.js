const mysql = require("mysql");

const token = "6902572315:AAFCSAgI2WrpLis2fiAXIzjfbPrQk7ThJOs";

const CONN = {
  host: "localhost",
  user: "answer",
  database: "answer",
  password: "qL0zExIVHz4W",
  charset: "utf8mb4",
};

const pool = mysql.createPool(CONN);

const SUB_STRING_CUSTOMER = "**Користувач**\n";
const SUB_STRING_OPERATOR = "__Oператор__\n";
const SUB_STRING_MENU = "^^Меню^^\n";

const ADMIN_ID = 388294070;

const Markdown = { parse_mode: "MarkdownV2" };

module.exports = {
  token,
  pool,
  SUB_STRING_CUSTOMER,
  SUB_STRING_OPERATOR,
  SUB_STRING_MENU,
  ADMIN_ID,
  Markdown,
};

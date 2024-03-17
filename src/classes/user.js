const SyncMysql = require("sync-mysql");
const mysql = require("mysql");
const {
  pool,
  SUB_STRING_CUSTOMER,
  SUB_STRING_OPERATOR,
  ADMIN_ID,
  SUB_STRING_MENU,
} = require("../configs/const");
const bot = require("../configs/bot");

class User {
  static queryToDb(sql, values) {
    try {
      return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
          if (err) {
            console.error("Ошибка при получении соединения из пула:", err);
            reject(err);
            return;
          }

          connection.query(sql, values, (error, results) => {
            connection.release();

            if (error) {
              if (error.message.startsWith("ER_CRASHED_ON_USAGE")) {
                pool.getConnection((err, connection) => {
                  connection.query(
                    "REPAIR TABLE users, chats",
                    (error, results) => {
                      connection.release();

                      if (error) {
                        bot.sendMessage(ADMIN_ID, "!!!!Пробема с БД!!!!");
                        reject(error);
                      } else {
                        resolve(results);
                      }
                    }
                  );
                });
              }
              console.error("Ошибка при выполнении запроса:", error);
              reject(error);
            } else {
              resolve(results);
            }
          });
        });
      });
    } catch (error) {
      this.throwingErr(error, "User", "setTimeoutNotifyOperator");
    }
  }

  constructor(msg) {
    this.text = msg.text || msg.caption || null;
    this.photoId = msg.photo ? msg.photo[2].file_id : null;
    this.chatId = msg.chat.id;
    this.userId = msg.from.id;
    this.name = msg.from.first_name;
    this.replyToMessage = this.getReplyToMessage(msg.reply_to_message);
    this.messageIds = {
      senderId: msg.message_id,
      getterIg: null,
    };
  }

  async queryToDb(query, values) {

    return await User.queryToDb(query, values);
  }

  getReplyToMessage(replyToMessage) {
    try {
      if (!replyToMessage) {
        return null;
      }
  
      let text = replyToMessage.text || null;
      const photoId = replyToMessage.photo
        ? replyToMessage.photo[2].file_id
        : null;
      const messageId = replyToMessage.message_id;
  
      if (text && text.includes(SUB_STRING_CUSTOMER)) {
        text = text.replace(SUB_STRING_CUSTOMER, "");
      }
  
      if (text && text.includes(SUB_STRING_OPERATOR)) {
        text = text.replace(SUB_STRING_OPERATOR, "");
      }
  
      if (text && text.includes(SUB_STRING_MENU)) {
        text = text.replace(SUB_STRING_MENU, "");
      }
  
      return {
        messageId,
        text,
        photoId,
      };
    } catch (error) {
      this.throwingErr(error, "User", "getReplyToMessage");
    }
  }

  async setIsReadTrue(openChatId) {
    if (!openChatId) {
      return;
    }

    const query = `UPDATE chats SET isRead = true WHERE chatId = ${openChatId}`;

    try {
      await this.queryToDb(query);
    } catch (error) {
      this.throwingErr(error, "Customer", "setIsReadTrue");
    }
  }

  async catchReply(currentChatId, operator) {
    const chatId = operator ? currentChatId : this.chatId;

    const query = `
      SELECT messageIds, isOperator
      FROM chats
      WHERE chatId = ?
        AND (messageIds LIKE '%"getterIg":${this.replyToMessage.messageId}%' OR messageIds LIKE '%"senderId":${this.replyToMessage.messageId}%')
      LIMIT 1
    `;

    try {
      const { messageIds: messageIdsJSON, isOperator } = (
        await this.queryToDb(query, [chatId])
      )[0];

      const messageIds = JSON.parse(messageIdsJSON);

      if ((isOperator && operator) || (!isOperator && !operator)) {
        this.photoId &&
          (await bot
            .sendPhoto(currentChatId, this.photoId, {
              reply_to_message_id: messageIds.getterIg,
            })
            .then((sentPhoto) =>
              this.sendMsgToBd(sentPhoto, chatId, operator, true)
            ));

        this.text &&
          (await bot
            .sendMessage(currentChatId, this.text, {
              reply_to_message_id: messageIds.getterIg,
            })
            .then((sentMessage) =>
              this.sendMsgToBd(sentMessage, chatId, operator, true)
            ));
      } else {
        this.photoId &&
          bot
            .sendPhoto(currentChatId, this.photoId, {
              reply_to_message_id: messageIds.senderId,
            })
            .then((sentPhoto) =>
              this.sendMsgToBd(sentPhoto, chatId, operator, true)
            );

        this.text &&
          bot
            .sendMessage(currentChatId, this.text, {
              reply_to_message_id: messageIds.senderId,
            })
            .then((sentMessage) =>
              this.sendMsgToBd(sentMessage, chatId, operator, true)
            );
      }
    } catch (error) {
      this.throwingErr(error, "User", "catchReply");

    }
  }

  async sendMsgToBd(
    sentMessage = null,
    chatId = this.chatId,
    isOperator = false,
    isRead = false
  ) {
    const getterIg = sentMessage ? sentMessage.message_id : null;

    this.messageIds.getterIg = getterIg;

    const query = `INSERT INTO chats (userId, chatId, name, textMessage, photoMessage, replyToMessage, messageIds, isOperator, isRead) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const jsonReplyToMessage = this.replyToMessage
      ? JSON.stringify(this.replyToMessage)
      : null;

    try {
      await this.queryToDb(query, [
        this.userId,
        chatId,
        this.name,
        this.text,
        this.photoId,
        jsonReplyToMessage,
        JSON.stringify(this.messageIds),
        isOperator,
        isRead,
      ]);
    } catch (error) {
      this.throwingErr(error, "User", "sendMsgToBd");
    }
  }

  static getObjMsgTypeFromDataType(msg) {
    return {
      text: msg.text,
      chat: {
        id: msg.message.chat.id,
      },
      from: {
        id: msg.from.id,
        first_name: msg.from.first_name,
      },
      message_id: msg.message_id,
    };
  }

  async getOperatorByCurrentChatId(chatId) {
    const query = `SELECT * FROM users WHERE currentChatId = ${chatId}`;

    try {
      return (await this.queryToDb(query))[0];
    } catch (error) {
      this.throwingErr(error, "User", "getOperatorByCurrentChatId");
    }
  }

  static async getJobTitle(userId) {
    const query = `
      SELECT u.jobTitle
      FROM users u
      LEFT JOIN users t ON u.userId = t.userId
      WHERE u.userId = '${userId}'
    `;

    try {
      const result = await User.queryToDb(query);

      return result[0] ? result[0]["jobTitle"] : null;
    } catch (error) {
      this.throwingErr(error, "User", "getJobTitle");
    }
  }

  throwingErr(error, who, method) {
    const newErrMessage = `в ${who}-${method} ${error.message}`;

    throw new Error(newErrMessage);
  }
}

module.exports = User;

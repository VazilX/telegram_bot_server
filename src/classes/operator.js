const User = require("./user");
const {
  CONN,
  SUB_STRING_CUSTOMER,
  SUB_STRING_OPERATOR,
  SUB_STRING_MENU,
} = require("../configs/const");
const bot = require("../configs/bot");
const { loggerErr } = require("../utils/loggerErr");

class Operator extends User {
  static notificationsTimeouts = {};

  async setOperatorByCurrentChatId(chatId) {
    const query = `SELECT * FROM users WHERE currentChatId = ${chatId}`;

    try {
      const operator = await this.queryToDb(query)[0];
      this.userId = operator.userId;
      this.chatId = operator.chatId;
    } catch (error) {
      this.throwingErr(error, 'Operator', 'setOperatorByCurrentChatId')
    }
  }

  async catchMessage() {
    try {
      const currentChatId = await this.getCurrentChatId();

      if (!currentChatId) {
        const textErr =
          "!*!*!Помилка: зпрочатку потрібно вибрати чат в який буде надіслано ваше повідомлення!*!*!";
        await bot.sendMessage(this.chatId, textErr);

        return;
      }

      const isOperator = true;

      if (this.replyToMessage) {
        await this.catchReply(currentChatId, isOperator);
      } else {
        const isRead = true;

        this.photoId &&
          (await bot
            .sendPhoto(currentChatId, this.photoId)
            .then(
              async (sentPhoto) =>
                await this.sendMsgToBd(
                  sentPhoto,
                  currentChatId,
                  isOperator,
                  isRead
                )
            ));

        this.text &&
          (await bot
            .sendMessage(currentChatId, this.text)
            .then(
              async (sentMessage) =>
                await this.sendMsgToBd(
                  sentMessage,
                  currentChatId,
                  isOperator,
                  isRead
                )
            ));
      }
    } catch (error) {
      loggerErr(`в Customer-catchMessage`, error);

      bot.sendMessage(
        this.chatId,
        `Упс, сталася помилка. це повідомлення скоріш за все не потрапило до клієнта ${error.message}`
      );
    }
  }

  async lookNotifications() {
    try {
      const notifications = await this.getNotifications();

      if (notifications.length === 0) {
        await bot.sendMessage(this.chatId, "Немає нових повідомлень");

        return;
      }

      const groupedNotifications = await this.groupingNotifications(
        notifications
      );

      const inline_keyboard = [];

      for (const chatId in groupedNotifications) {
        const { messages, name } = groupedNotifications[chatId];

        inline_keyboard.push([
          {
            text: `${name} ${messages.length} повідомлень`,
            callback_data: `openChat ${chatId}`,
          },
        ]);
      }

      const lookNotificationsBtn = {
        reply_markup: JSON.stringify({
          inline_keyboard,
        }),
      };

      await bot.sendMessage(this.chatId, "Виберіть чат", lookNotificationsBtn);

      clearTimeout(Operator.notificationsTimeouts[this.chatId]);
    } catch (error) {
      loggerErr(`в Customer-lookNotifications`, error);

      bot.sendMessage(
        this.chatId,
        `Упс, сталася помилка.`
      );
    }
  }

  async getNotifications() {
    const query = `SELECT * FROM chats WHERE isRead = 0 AND isOperator = false AND isMenu = false`;

    try {
      return await this.queryToDb(query);
    } catch (error) {
      loggerErr(`в Customer-getNotifications`, error);

      return [];
    }
  }

  groupingNotifications(notifications) {
    try {
      return notifications.reduce((chats, notification) => {
        const { chatId, name, textMessage, date } = notification;

        chats[chatId] = chats[chatId] || { name, messages: [] };
        chats[chatId].messages.push({ text: textMessage, date });

        return chats;
      }, {});
    } catch (error) {
      this.throwingErr(error, 'Operator', 'groupingNotifications')
    }
  }

  async setCurrentChatId(openChatId) {
    const query = `UPDATE users SET currentChatId = ${openChatId} WHERE users.userId = ${this.userId}`;

    try {
      return await this.queryToDb(query);
    } catch (error) {
      loggerErr(`в Customer-setCurrentChatId (chatId === ${chatId})`, error);

      return [];
    }
  }

  async getCurrentChatId() {
    const query = `SELECT currentChatId FROM users WHERE userId = ${this.userId}`;

    try {
      const result = await this.queryToDb(query);

      return result[0].currentChatId;
    } catch (error) {
      this.throwingErr(error, 'Operator', 'getCurrentChatId')
    }
  }

  async getNoReadMessages(openChatId) {
    const query = `SELECT * FROM chats WHERE chatId = ${openChatId} AND isRead = false ORDER BY date`;

    try {
      let messages = await this.queryToDb(query);

      let needUpdate = true;

      if (messages.length === 0) {
        const currentOperator = await this.getOperatorByCurrentChatId(
          openChatId
        );

        if (currentOperator && currentOperator !== this.userId) {
          await this.notifyPresenceOperator();
        } else {
          messages = await this.getLastTenMessage(openChatId);
          needUpdate = false;
        }
      }

      messages.sort(
        (message1, message2) =>
          new Date(message1.date) - new Date(message2.date)
      );

      await this.sendNoReadMessages(messages, needUpdate);

      this.setIsReadTrue(openChatId);
    } catch (error) {
      loggerErr(`в Customer-getNoReadMessages (openChatId === ${openChatId})`, error);

      bot.sendMessage(
        this.chatId,
        `Упс, сталася помилка. ${error.message}`
      );
    }
  }

  async getLastTenMessage(openChatId) {
    const query = `
      SELECT * 
      FROM chats 
      WHERE chatId = ${openChatId} 
      ORDER BY date 
      DESC LIMIT 10
    `;

    try {
      return await this.queryToDb(query);
    } catch (error) {
      this.throwingErr(error, 'Operator', 'getLastTenMessage')
    }
  }

  async notifyPresenceOperator() {
    // уведомить о наличии оператора
    try {
      await bot.sendMessage(
        this.chatId,
        "З цим клієнтом зараз працує інший оператор"
      );

      const lookNotificationsBtn = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              {
                text: "Переглянути повідомлення",
                callback_data: "lookNotifications",
              },
            ],
            [
              {
                text: "Переглянути список діалогів без нових повідомленнь",
                callback_data: "chatsNoNotifications",
              },
            ],
          ],
        }),
      };

      await bot.sendMessage(
        this.chatId,
        "Що ви бажаєте зробити?",
        lookNotificationsBtn
      );
    } catch (error) {
      this.throwingErr(error, 'Operator', 'notifyPresenceOperator')
    }

    return;
  }

  async sendNoReadMessages(messages, needUpdate) {
    try {
      for (const message of messages) {
        let text =
          message.textMessage && `${SUB_STRING_CUSTOMER}${message.textMessage}`;
        const photoId = message.photoMessage;
        const { messageIds: messageIdsJSON, id } = message;

        if (message.isOperator && message.textMessage) {
          text = `${SUB_STRING_OPERATOR}${message.textMessage}`;
        }

        if (message.isMenu && message.textMessage) {
          text = `${SUB_STRING_MENU}${message.textMessage}`;
        }

        const messageIds = JSON.parse(messageIdsJSON);

        await this.sendMsgToBd();

        text &&
          (await this.sendMessage(this.chatId, text).then(
            async (sentMessage) =>
              await this.updateMessageInBd(
                sentMessage,
                messageIds,
                id,
                needUpdate
              )
          ));

        photoId &&
          (await bot
            .sendPhoto(this.chatId, photoId)
            .then(
              async (sentPhoto) =>
                await this.updateMessageInBd(
                  sentPhoto,
                  messageIds,
                  id,
                  needUpdate
                )
            ));
      }
    } catch (error) {
      this.throwingErr(error, 'Operator', 'sendNoReadMessages')
    }
  }

  async delaySendMessage() {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  async updateMessageInBd(sentMessage, messageIds, id, needUpdate) {
    console.log(sentMessage);

    try {
      if (!needUpdate) {
        return;
      }

      messageIds.getterIg = sentMessage.message_id;
      const query = `
        UPDATE chats
        SET messageIds = ?
        WHERE id = ?;
      `;

      await this.queryToDb(query, [JSON.stringify(messageIds), id]);
    } catch (error) {
      this.throwingErr(error, 'Operator', 'updateMessageInBd')
    }
  }

  async lookHistory() {
    try {
      const arrNameChatId = await this.getArrNameChatId();
      const lookHistoryBtn = await this.getLookHistoryBtn(arrNameChatId);

      bot.sendMessage(
        this.chatId,
        "Виберіть діалог історію якого бажаєте подивитись",
        lookHistoryBtn
      );
    } catch (error) {
      loggerErr(`в Customer-lookHistory`, error);


      bot.sendMessage(
        this.chatId,
        `Упс, сталася помилка. ${error.message}`
      );
    }
  }

  async getArrNameChatId() {
    try {
      let query = `
      SELECT DISTINCT chatId
      FROM chats
      WHERE isOperator = false
      ORDER BY (
        SELECT date
        FROM chats AS t2
        WHERE t2.chatId = chats.chatId
        ORDER BY date DESC
        LIMIT 1
      )`;

      const chats = await this.queryToDb(query);

      const arrNameChatId = chats.map(async (chat) => {
        const { chatId } = chat;

        query = `SELECT name FROM users WHERE chatId = ${chatId}`;

        const { name } = (await this.queryToDb(query))[0];

        return { name, chatId };
      });

      return arrNameChatId;
    } catch (error) {
      this.throwingErr(error, 'Operator', 'getArrNameChatId')

    }
  }

  async getLookHistoryBtn(arrNameChatId) {
    try {
      const inline_keyboard = [];

      for (const nameChatId of arrNameChatId) {
        const { chatId, name } = await nameChatId;
  
        inline_keyboard.push([
          {
            text: `${name}`,
            url: `http://answer.activegroup.com.ua/telegram_bot/client
            :3000?chatId=${chatId}&operatorId=${this.userId}`,
          },
        ]);
      }
  
      const lookNotificationsBtn = {
        reply_markup: JSON.stringify({
          inline_keyboard,
        }),
      };
  
      return lookNotificationsBtn;
    } catch (error) {
      this.throwingErr(error, 'Operator', 'getLookHistoryBtn')
    }
  }

  async lookMenu() {
    try {
      const lookNotificationsBtn = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "Преглянути повідомлення", callback_data: "notifications" }],
            [{ text: "Преглянути історію", callback_data: "history" }],
            [
              {
                text: "Преглянути список діалогів без нових повідомленнь",
                callback_data: "chatsNoNotifications",
              },
            ],
          ],
        }),
      };
  
      await bot.sendMessage(
        this.chatId,
        "Що ви хочете зробити?",
        lookNotificationsBtn
      );
    } catch (error) {
      this.throwingErr(error, 'Operator', 'lookMenu')
    }
  }

  async lookAllChats() {
    try {
      const arrNameChatId = await this.getArrNameChatId();
      const lookAllChatsBtn = await this.lookAllChatsBtn(arrNameChatId);
  
      await bot.sendMessage(
        this.chatId,
        "Виберіть чат до якого ви бажаєте підєднатися",
        lookAllChatsBtn
      );
    } catch (error) {
      this.throwingErr(error, 'Operator', 'lookAllChats')
    }
  }

  async lookAllChatsBtn(arrNameChatId) {
    try {
      const inline_keyboard = [];

      for (const nameChatId of arrNameChatId) {
        const { chatId, name } = await nameChatId;
  
        inline_keyboard.push([
          {
            text: `${name}`,
            callback_data: `openChat ${chatId}`,
          },
        ]);
      }
  
      const lookNotificationsBtn = {
        reply_markup: JSON.stringify({
          inline_keyboard,
        }),
      };
  
      return lookNotificationsBtn;
    } catch (error) {
      loggerErr(`в Customer-lookAllChatsBtn`, error);

      bot.sendMessage(
        this.chatId,
        `Упс, сталася помилка. ${error.message}`
      );
    }
  }
}

module.exports = Operator;

const User = require("./user");
const { CONN, Markdown } = require("../configs/const");
const bot = require("../configs/bot");
const Operator = require("./operator");
const customerMenu = require("../modules/customerMenu");
const { loggerErr } = require("../utils/loggerErr");

class Customer extends User {
  static antiSpamTimeouts = {};

  static hasBan(userId) {
    try {
      if (Customer.antiSpamTimeouts[userId]?.count >= 10) {
        return true;
      }

      return false;
    } catch (error) {
      loggerErr("в Customer-getBusyOperators", error);

      return false;
    }
  }

  async antiSpam() {
    try {
      const { userId, chatId, name } = this;

      Customer.antiSpamTimeouts[userId] = Customer.antiSpamTimeouts[userId] || {
        count: 0,
        timeout: setTimeout(
          () => () => {
            Customer.antiSpamTimeouts[userId].count = 0;
          },
          60000
        ),
      };
  
      let { count, timeout } = Customer.antiSpamTimeouts[userId];
  
      count++;
  
      if (count >= 8 && count < 10) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          Customer.antiSpamTimeouts[userId].count = 0;
        }, 15000);
  
        Customer.antiSpamTimeouts[userId] = { count, timeout };
        return true;
      }
  
      if (count >= 10) {
        clearTimeout(timeout);
  
        timeout = setTimeout(async () => {
          Customer.antiSpamTimeouts[userId].count = 0;
  
          const query = `INSERT INTO chats (userId, chatId, name, textMessage, isOperator, isRead) 
            VALUES (?, ?, ?, ?, ?, ?)`;
  
          await this.queryToDb(query, [
            userId,
            chatId,
            name,
            "*%*%*BAN-OF",
            false,
            true,
          ]);
        }, 900000);
  
        Customer.antiSpamTimeouts[userId] = { count, timeout };
  
        const query = `INSERT INTO chats (userId, chatId, name, textMessage, isOperator, isRead) 
        VALUES (?, ?, ?, ?, ?, ?)`;
  
        await this.queryToDb(query, [
          userId,
          chatId,
          name,
          "*%*%*BAN-ON",
          false,
          true,
        ]);
  
        return true;
      }
  
      Customer.antiSpamTimeouts[userId].count = count;
  
      return false;
    } catch (error) {
      this.throwingErr(error, 'Customer', 'antiSpam')
    }
  }

  static notifyAboutBan(chatId) {
    const count = Customer.antiSpamTimeouts[chatId].count;
    const finishBanIn = Customer.getTimeFinishBan();

    try {
      switch (count) {
        case 8:
          bot.sendMessage(
            chatId,
            "_Занадто багато повідомлень за 1 хвилину_, зачекайте, оператор скоро вам відповість",
            Markdown
          );
          return;
        case 9:
          bot.sendMessage(
            chatId,
            "_Занадто багато повідомлень за 1 хвилину_, зачекайте, оператор скоро вам відповість\\. *За перевищення кількості повідомлень за хвилину вас може бути заблокованно на 15 хвилин*",
            Markdown
          );
          return;
        // case 10:
        //   bot.sendMessage(
        //     chatId,
        //     `Вас *заблокованно* на _15_ хвилин\\. Наступні повідомлення, ротягом цього часу, не будуть переправлятися оператору\\. Очікуванний час закінчення бану: *${finishBanIn}*`,
        //     Markdown
        //   );
        //   return;

        default:
          bot.sendMessage(
            chatId,
            `Вас *заблокованно* на _15_ хвилин\\. Протягом цього часу повідомлення не будуть переправлятися оператору`,
            Markdown
          );

          return;
      }
    } catch (error) {
      loggerErr(`в Customer-notifyAboutBan (chatId === ${chatId})`, error);

      bot.sendMessage(
        this.chatId,
        `Упс, сталася помилка.`
      );
    }
  }

  static getTimeFinishBan() {
    const currentTime = new Date();
    const futureTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    const hours = futureTime.getHours();
    const minutes = futureTime.getMinutes();

    return `${hours}:${minutes}`;
  }

  async registration() {
    const query = `
      INSERT INTO users (userId, chatId, name, jobTitle)
      VALUES (?, ?, ?, "customer")
      ON DUPLICATE KEY UPDATE
      chatId = VALUES(chatId),
      jobTitle = VALUES(jobTitle),
      name = VALUES(name)
    `;

    try {
      await this.queryToDb(query, [this.userId, this.chatId, this.name]);
    } catch (error) {
      loggerErr(`в Customer-registration`, error);

      bot.sendMessage(
        this.chat,
        "Упс, виникла помилка реєстрації. Введіть /start"
      );
    }
  }

  async catchMessage() {
    try {
      if (await this.antiSpam()) {
        Customer.notifyAboutBan(this.chatId);
      }

      const userOperator = await this.getOperatorByCurrentChatId(this.chatId);

      if (userOperator) {
        try {
          const { chatId } = userOperator;
          const isOperator = false;

          if (this.replyToMessage) {
            await this.catchReply(chatId, isOperator);
          } else {
            const isRead = true;

            this.photoId &&
              (await bot
                .sendPhoto(chatId, this.photoId)
                .then(
                  async (sentPhoto) =>
                    await this.sendMsgToBd(
                      sentPhoto,
                      this.chatId,
                      isOperator,
                      isRead
                    )
                ));

            this.text &&
              (await bot
                .sendMessage(chatId, this.text)
                .then(
                  async (sentMessage) =>
                    await this.sendMsgToBd(
                      sentMessage,
                      this.chatId,
                      isOperator,
                      isRead
                    )
                ));
          }

          await this.setIsReadTrue(this.chatId);
        } catch (error) {
          loggerErr("в Customer catchMessage, userOperator === true", error);

          bot.sendMessage(this.chat, "Помилка відповіді з сервера");
        }
      } else {
        const freeOperators = await this.getFreeOperators();
        const busyOperators = await this.getBusyOperators();

        this.notifyOperators(freeOperators, busyOperators);

        this.sendMsgToBd();
      }
    } catch (error) {
      loggerErr("в Customer-catchMessage (userOperator === false)", error);

      bot.sendMessage(this.chat, "Помилка відповіді з сервера");
    }
  }

  async getFreeOperators() {
    const query = `
      SELECT * 
      FROM users 
      WHERE jobTitle IN ('operator', 'admin')
        AND currentChatId IS NULL
    `;

    try {
      return await this.queryToDb(query);
    } catch (error) {
      this.throwingErr(error, 'Customer', 'getFreeOperators')
    }
  }

  async getBusyOperators() {
    const query = `
      SELECT * 
      FROM users 
      WHERE jobTitle IN ('operator', 'admin')
        AND currentChatId IS NOT NULL
      `;

    try {
      return await this.queryToDb(query);
    } catch (error) {
      this.throwingErr(error, 'Customer', 'getBusyOperators')
    }
  }

  notifyOperators(freeOperators, busyOperators) {
    try {
      const lookNotificationsBtn = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              {
                text: "Переглянути повідомлення",
                callback_data: "lookNotifications",
              },
            ],
          ],
        }),
      };

      freeOperators.forEach((freeOperator) => {
        this.setTimeoutNotifyOperator(
          freeOperator.chatId,
          3000,
          lookNotificationsBtn
        );
      });

      busyOperators.forEach((busyOperator) => {
        this.setTimeoutNotifyOperator(
          busyOperator.chatId,
          900000,
          lookNotificationsBtn
        );
      });
    } catch (error) {
      this.throwingErr(error, 'Customer', 'notifyOperators')
    }
  }

  setTimeoutNotifyOperator(operatorId, delay, notification) {
    try {
      const timeout = Operator.notificationsTimeouts[operatorId];

      clearTimeout(timeout);

      Operator.notificationsTimeouts[operatorId] = setTimeout(async () => {
        await bot.sendMessage(
          operatorId,
          "У Вас нове повідомлення",
          notification
        );
      }, delay);
    } catch (error) {
      this.throwingErr(error, 'Customer', 'setTimeoutNotifyOperator')
    }
  }

  async setMenuField(menuField) {
    try {
      const jsonReplyToMessage = this.replyToMessage
        ? JSON.stringify(this.replyToMessage)
        : null;

      const query = `
      INSERT INTO chats (userId, chatId, name, textMessage, messageIds, isMenu)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

      await this.queryToDb(query, [
        this.userId,
        this.chatId,
        this.name,
        menuField,
        jsonReplyToMessage,
        true,
      ]);
    } catch (error) {
      await bot.sendMessage(
        this.chatId,
        "Упс, сталася помилка, спробуйте ще раз /menu",
        customerMenu
      );

      loggerErr(`в Customer-setMenuField (menuField === ${menuField})`, error);

      bot.sendMessage(
        this.chatId,
        `Упс, сталася помилка.`
      );
    }
  }

  async setUselessMenu() {
    try {
      const query = `
      UPDATE chats
      SET isRead = true
      WHERE chatId = ${this.chatId} AND isMenu = true
    `;

      await this.queryToDb(query);
    } catch (error) {
      loggerErr(`в Customer-setUselessMenu`, error);

      bot.sendMessage(
        this.chatId,
        `Упс, сталася помилка.`
      );
    }
  }
}

module.exports = Customer;

const customerMenu = require("./modules/customerMenu.js");
const Customer = require("./classes/customer.js");
const bot = require("./configs/bot.js");
const Operator = require("./classes/operator.js");

const server = require("./server/server.js");
const User = require("./classes/user.js");
const mainMenuBtn = require("./modules/mainMenuBtn.js");
const paymentMenu = require("./modules/paymentMenu.js");
const goToMenuMenu = require("./modules/goToMenuMenu.js");
const { loggerNeedMsgType } = require("./utils/loggerNeedMsgType.js");

bot.setMyCommands([
  { command: "/start", description: "регистрация" },
  { command: "/want_be_operator", description: "бажаю стати оператором" },
  { command: "/menu", description: "Меню" },
]);

bot.on("photo", async (msg) => {
  const userId = msg.from.id;

  if (Customer.hasBan(userId)) {
    Customer.notifyAboutBan(userId);

    return;
  }

  let jobTitle = await User.getJobTitle(userId);

  if (jobTitle === null) {
    const customer = new Customer(msg);

    customer.registration();
    jobTitle = "customer";
  }

  if (jobTitle === "customer") {
    const customer = new Customer(msg);

    await customer.catchMessage();
  } else {
    const operator = new Operator(msg);

    await operator.catchMessage();
  }
});

bot.on("text", async (msg) => {
  console.log("НОВОЕ СООБЩЕНИЕ");

  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageId = msg.message_id;

  if (Customer.hasBan(userId)) {
    Customer.notifyAboutBan(userId);

    return;
  }

  let jobTitle = await User.getJobTitle(userId);
  console.log("jobTitle = ", jobTitle, `(${msg.from.first_name})`);

  if (jobTitle === null) {
    const customer = new Customer(msg);

    customer.registration();

    jobTitle = "customer";
  }

  if (text === "/start") {
    if (jobTitle === "customer" || !jobTitle) {
      const customer = new Customer(msg);

      customer.registration();
      await bot.sendMessage(
        chatId,
        "З приводу якого питання ви звертаєтесь?",
        customerMenu
      );
    } else {
      const operator = new Operator(msg);

      await operator.setCurrentChatId(null);
      await operator.lookNotifications();
    }

    bot.deleteMessage(chatId, messageId);
    return;
  }

  if (text === "/want_be_operator") {
    await bot.sendMessage(
      chatId,
      `customerId --- ${msg.from.id}\nWant to be an "operator"`
    );

    bot.deleteMessage(chatId, messageId);
    return;
  }

  if (text === "/menu") {
    if (jobTitle === "customer") {
      await bot.sendMessage(
        chatId,
        "Ви впевнені що бажаєте повернутися до меню? Ввше питання буде відмічене як вирішене",
        goToMenuMenu
      );
    } else {
      const operator = new Operator(msg);
      await operator.setCurrentChatId(null);
      await operator.lookMenu();
    }

    bot.deleteMessage(chatId, messageId);
    return;
  }

  if (jobTitle === "customer") {
    const customer = new Customer(msg);

    await customer.catchMessage();
  } else {
    const operator = new Operator(msg);

    await operator.catchMessage();
  }
});

bot.on("callback_query", async (msg) => {
  const data = msg.data;
  const chatId = msg.message.chat.id;
  const userId = msg.message.from.id;

  bot.deleteMessage(chatId, msg.message.message_id);

  if (Customer.hasBan(userId)) {
    Customer.notifyAboutBan(userId);

    return;
  }

  if (data === "techReport") {
    const message = User.getObjMsgTypeFromDataType(msg);

    const customer = new Customer(message);
    await customer.setMenuField("Повідомити про технічну проблему");

    await bot.sendMessage(
      chatId,
      "Будь-ласка, опишіть проблему. За можливості – додайте скрін-шоти та іншу інформацію",
      mainMenuBtn
    );
  }

  if (data === "paymentIssue") {
    const message = User.getObjMsgTypeFromDataType(msg);

    const customer = new Customer(message);
    await customer.setMenuField("Питання оплати");

    await bot.sendMessage(
      chatId,
      "Гроші надсилаються на мобільний номер або на благодійність протягом двох тижнів після заявки",
      paymentMenu
    );
  }

  if (data === "otherQuestions") {
    const message = User.getObjMsgTypeFromDataType(msg);

    const customer = new Customer(message);
    await customer.setMenuField("Інші питання");

    await bot.sendMessage(chatId, "Будь-ласка, опишіть ваш запит", mainMenuBtn);
  }

  if (data === "orderResearch") {
    const message = User.getObjMsgTypeFromDataType(msg);

    const customer = new Customer(message);
    await customer.setMenuField("Замовити дослдіження");

    await bot.sendMessage(
      chatId,
      'Ви можете замовити як окреме дослідження, так і запитання, яке буде задане разом з черговим "Пульсом Тижня". Для прорахунку напишіть ваш запит і як з вами можна зв’язатись',
      mainMenuBtn
    );
  }

  if (data === "supportProject") {
    const message = User.getObjMsgTypeFromDataType(msg);

    const customer = new Customer(message);
    await customer.setMenuField("Підтримати проект");

    await bot.sendMessage(
      chatId,
      "Проекту «Пульс Тижня» потрібна ваша підтримка. Допомогти нам можна через «Банку» Монобанку (https://send.monobank.ua/jar/cGUkoJuC6) або ставши нашим патроном на Патреоні (https://www.patreon.com/pulsweek)",
      mainMenuBtn
    );
  }

  if (data === "mainMenu") {
    const message = User.getObjMsgTypeFromDataType(msg);

    const customer = new Customer(message);
    await customer.setUselessMenu();

    await bot.sendMessage(
      chatId,
      "З приводу якого питання ви звертаєтесь?",
      customerMenu
    );
  }

  if (data === "lookNotifications") {
    const message = {
      text: msg.text,
      chat: {
        id: msg.message.chat.id,
      },
      from: {
        id: msg.from.id,
        first_name: msg.from.first_name,
      },
    };
    const operator = new Operator(message);
    operator.setCurrentChatId(null);
    operator.lookNotifications();
  }

  if (data.startsWith("openChat")) {
    const openChatId = data.split(" ")[1];
    const message = User.getObjMsgTypeFromDataType(msg);

    const operator = new Operator(message);

    await operator.getNoReadMessages(openChatId);
    operator.setCurrentChatId(openChatId);
  }

  if (data === "notifications") {
    const message = User.getObjMsgTypeFromDataType(msg);
    const operator = new Operator(message);
    operator.lookNotifications();
  }

  if (data === "history") {
    const message = User.getObjMsgTypeFromDataType(msg);
    const operator = new Operator(message);
    operator.lookHistory();
  }

  if (data === "chatsNoNotifications") {
    const message = User.getObjMsgTypeFromDataType(msg);
    const operator = new Operator(message);

    operator.lookAllChats();
  }
});

bot.on("voice", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("voice");
});
bot.on("video_note", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );

  loggerNeedMsgType("video_note");
});
bot.on("audio", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("audio");
});

bot.on("document", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("document");
});
bot.on("sticker", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("sticker");
});
bot.on("video", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("video");
});
bot.on("contact", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("contact");
});
bot.on("location", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("location");
});
bot.on("new_chat_members", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("new_chat_members");
});
bot.on("left_chat_member", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("left_chat_member");
});
bot.on("new_chat_title", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("new_chat_title");
});
bot.on("new_chat_photo", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("new_chat_photo");
});
bot.on("delete_chat_photo", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("delete_chat_photo");
});
bot.on("group_chat_created", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("group_chat_created");
});
bot.on("game", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("game");
});
bot.on("pinned_message", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("pinned_message");
});
bot.on("poll", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("poll");
});
bot.on("dice", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("dice");
});
bot.on("migrate_from_chat_id", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("migrate_from_chat_id");
});
bot.on("migrate_to_chat_id", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("migrate_to_chat_id");
});
bot.on("channel_chat_created", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("channel_chat_created");
});
bot.on("supergroup_chat_created", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("supergroup_chat_created");
});
bot.on("successful_payment", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("successful_payment");
});
bot.on("invoice", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("invoice");
});
bot.on("video_note", (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Пробачте, ми вміємо тільки читати та дивитися на картинки"
  );
  loggerNeedMsgType("video_note");
});

const mainMenuBtn = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [{text: "Головне меню", callback_data: 'mainMenu'}],
    ],
  }),
}

module.exports = mainMenuBtn;
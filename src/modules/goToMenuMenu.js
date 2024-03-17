const goToMenuMenu = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [{text: "Так", callback_data: 'mainMenu'}],
      [{text: "Ні", callback_data: 'stay'}],
    ],
  }),
}

module.exports = goToMenuMenu;
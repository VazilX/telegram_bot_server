const paymentMenu = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [{text: "Інші питання", callback_data: 'otherQuestions'}],
      [{text: "Головне меню", callback_data: 'mainMenu'}],
    ],
  }),
}

module.exports = paymentMenu;

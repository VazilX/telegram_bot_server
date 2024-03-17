const customerMenu = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [{text: "Повідомити про технічну проблему", callback_data: 'techReport'}],
      [{text: "Питання оплати", callback_data: 'paymentIssue'}],
      [{text: "Замовити дослідження", callback_data: 'orderResearch'}],
      [{text: "Підтримати проект", callback_data: 'supportProject'}],
    ],
  }),
}

module.exports = customerMenu;
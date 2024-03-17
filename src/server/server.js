const SyncMysql = require('sync-mysql');
const express = require('express');
const cors = require('cors');
const { CONN, token } = require('../configs/const');
const bot = require('../configs/bot');


async function getLinkImg(photo) {
  if (photo) {
    const file = await bot.getFile(photo)
    const fileDir = file.file_path;

    return `https://api.telegram.org/file/bot${token}/${fileDir}`;
  }

  return null;
}

const PORT = 5000;

const app = express();
app.use(cors());

app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  const { chatId, operatorId } = req.query;

  if (!chatId) {
    res.json({err: 'Виберіть колієнта'});
    return;
  }
  
  const connection = new SyncMysql(CONN);
  const query = `SELECT * FROM chats WHERE chatId = ${chatId}`
  const chat = connection.query(query);

  const chatWithPhoto = [];

  for (const message of chat) {

    const { messageIds, replyToMessage: replyToMessageJson } = message;
    let photoMessage = message.photoMessage;
    let replyToMessage = (replyToMessageJson && replyToMessageJson !== 'null') ? JSON.parse(replyToMessageJson) : null;

    photoMessage = await getLinkImg(photoMessage);

    if (replyToMessage) {
      replyToMessage.photoId = await getLinkImg(replyToMessage.photoId);
    }

    chatWithPhoto.push({
      ...message,
      photoMessage,
      messageIds: JSON.parse(messageIds),
      replyToMessage,
    });
  }
  chatWithPhoto.sort((message1, message2) => message1.date - message2.date);

  res.json(chatWithPhoto); //передать объект данных на которых будет строиться страница
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

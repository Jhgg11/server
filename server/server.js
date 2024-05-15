const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const Schema = mongoose.Schema;

// Define MongoDB schema for user balances
const balanceSchema = new Schema({
  userId: { type: String, unique: true },
  balance: { type: Number, default: 0 },
  numberOfRef: { type: Number, default: 0 },
  earnedBirdsByRef: { type: Number, default: 0 },
  referalCode: { type: String, default: '' },
  usersIdUsedReferal: { type: Array, default: [] },
  eggsBlock: { type: Array, default: [] },
  birdToken: { type: Number, default: 0 },
  score: { type: Number, default: 0 }
});

const Balance = mongoose.model('Balance', balanceSchema);

// MongoDB connection
const mongoURL = process.env.MONGO_URL;
const token = process.env.TELEGRAM_TOKEN;
const testW = process.env.TEST_W;

mongoose.connect(mongoURL)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));


// API endpoints
app.get("/api/getUser/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    let user = await Balance.findOne({ userId });

    // If the user doesn't exist, create a new one
    if (!user) {
      user = await Balance.create({ userId });
    }

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/balance/bird/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await Balance.findOneAndUpdate({ userId }, { $inc: { birdToken: 1 } }, { new: true });
    res.status(200).json({ birdBal: user.birdToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/balance/withdraw', async (req, res) => {
  const { wallet, sumW, addressW } = req.query;
  try {
    const user = await Balance.findOneAndUpdate({ userId: wallet }, { $inc: { balance: -sumW } }, { new: true });
    bot.sendMessage(testW, `User-Sum-For-Send: ${sumW}\nUser-Address-Dest: ${addressW}`)
    res.json({ newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transaction', async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const response = await Balance.findOneAndUpdate({ userId }, { $push: { eggsBlock: amount } });
    const sixHoursInMilliseconds = 6 * 60 * 60 * 1000;
    setTimeout(async () => {
      await Balance.findOneAndUpdate({ userId }, { $inc: { balance: amount / 1000000000 }, $pop: { eggsBlock: -1 } });
    }, sixHoursInMilliseconds);
    res.status(200).send('Transaction initiated.');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/getReferralLink', async (req, res) => {
  const walletAddress = req.body.walletAddress;
  try {
    let referralLink = '';
    const user = await Balance.findOne({ userId: walletAddress });
    if (!user.referalCode) {
      referralLink = generateReferralLink(walletAddress);
      await Balance.findOneAndUpdate({ userId: walletAddress }, { referalCode: referralLink });
    } else {
      referralLink = user.referalCode;
    }
    res.json({ referralLink });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/score/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Balance.findOneAndUpdate({ userId: id }, { $inc: { score: +10 } }, { new: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


function generateReferralLink(walletAddress) {
  const referralCode = (Date.now() + testW).toString();
  referalLinks.push(referralCode);
  return `https://t.me/testBotAndrii_bot?start=${referralCode}`;
}

// Start server
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

//botTG

//const token = '6484393004:AAEdh33cUB297XIMAq8JPMWAi_qzrvMJkXQ'; need to //

// Создание экземпляра бота 
const bot = new TelegramBot(`${token}`, { polling: true });


bot.onText(/^\/start(?:\s(.*))?$/, (msg, match) => {
  const chatId = msg.chat.id;
  if (match && match[1]) {
    const referralCode = match[1];
    extractReferralUserId(referralCode, chatId);
  } else {
    bot.sendMessage(chatId, "Регистрация успешно завершена!");
  }
  
  bot.sendMessage(chatId, '<a href="https://t.me/RichBirdsOnTON">Telegram Channel</a>\n<a href="https://t.me/RichBirdsOnTON_Chat">Telegram Chat</a>', {parse_mode: 'HTML'});

});

// Функция для извлечения информации о пользователе по реферальному коду
function extractReferralUserId(referralCode, chatId) {
  if (referalLinks.includes(referralCode)) {
    const userId = findUserByReferralCode(referralCode);
    if (userId) {
      if (balances[userId].usersIdUsedReferal.includes(chatId.toString())) {
        bot.sendMessage(chatId, `Вы уже активировали реферальную ссылку`);
      } else {
        balances[userId].balance += 0.01;
        balances[userId].numberOfRef++;
        balances[userId].earnedBirdsByRef += 0.5;
        balances[userId].usersIdUsedReferal.push(chatId.toString());
        bot.sendMessage(chatId, "Регистрация успешно завершена!");
        bot.sendMessage(chatId, `Вы активировали реферальную ссылку`);
      }
    } else {
      bot.sendMessage(chatId, 'Такой реферальной ссылки не найдено');
    }
  } else {
    bot.sendMessage(chatId, 'Такой реферальной ссылки не найдено');
  }
}
// Функция для поиска пользователя по реферальному коду
function findUserByReferralCode(referralCode) {
  for (const userId in balances) {
    if (balances.hasOwnProperty(userId)) {
      const userInfo = balances[userId];
      if (userInfo.referalCode === referralCode) {
        return userId;
      }
    }
  }
  return null;
}

bot.onText(/\/play/, (msg, match) => {
  const chatId = msg.chat.id;
  const miniAppUrl = 'YOUR_MINI_APP_URL_HERE'; 
  
  bot.sendMessage(chatId, `Привлекайте друзей и зарабатывайте вместе TON и $birds покупая яйца для получения вознаграждений в виде TON. Расширяйте возможности, инвестируя в яйца. \n*Взимается всего 1% комиссии с чистой прибыли для поддержки и развития игры, обеспечивая ее долгосрочный рост и стабильность.\n\n${miniAppUrl}`);
});

bot.onText(/\/info/, (msg, match) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, `Каждая ваша покупка яиц превращается в гору TON и $birds. Просто ухаживайте за пернатыми друзьями, и когда они высиживают яйца, собирайте свою прибыль — монеты становятся вашими!\n
За каждого нового приглашенного друга вы получаете 10 $bird\n
Наслаждайтесь и увеличения доход вместе с вашими пернатыми питомцами!\n
Токеномика $birds\n
20% — PlayToAirdrop\n
30% — Открытый запуск\n
15% — Листинг на DEX\n
10% — Фарминг\n
10% — Команда\n
15% — Маркетинг\n
Начинайте зарабатывать TON и накапливать вознаграждения уже сейчас!
  `);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const availableCommands = [
    "/play - присоединиться к игре",
    "/info - получить информацию о боте",
    "/help - просмотреть список всех доступных команд"
  ];
  const commandsText = availableCommands.join("\n");

  bot.sendMessage(chatId, `Доступные команды:\n${commandsText}`);
});

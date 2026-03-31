const express = require('express');
const connectDB = require('./DB/connection');
const dotenv = require('dotenv');
const cokkies = require('cookie-parser');
const cors = require('cors');
const AuthRouter = require('./router/auth.router');

const app = express();
dotenv.config();
connectDB();
app.use(express.json());
app.use(cokkies());
app.use(cors());
app.use('/api/auth', AuthRouter);


app.get('/', (req, res) => {
  res.send('Hello World!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
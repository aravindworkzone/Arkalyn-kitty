const express = require('express');
const connectDB = require('./DB/connection');
const dotenv = require('dotenv');
const cokkies = require('cookie-parser');
const cors = require('cors');
const AuthRouter = require('./router/auth.router');
const ExpenseRouter = require('./router/expense.router');
const CategoryRouter = require('./router/category.router');
const GroupRouter = require('./router/group.router');
const ReportRouter = require('./router/report.router');

const app = express();
dotenv.config();
connectDB();
app.use(express.json());
app.use(cokkies());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use('/api/auth', AuthRouter);
app.use('/api/expense', ExpenseRouter);
app.use('/api/category', CategoryRouter);
app.use('/api/group', GroupRouter);
app.use('/api/report', ReportRouter);


app.get('/', (req, res) => {
  res.send('Hello World!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
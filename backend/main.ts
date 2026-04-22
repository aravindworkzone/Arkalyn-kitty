import express, {Application, Request, Response} from 'express';
import connectDB from './DB/connection';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import AuthRouter from './Router/auth.router';
import ExpenseRouter from './Router/expense.router';
import CategoryRouter from './Router/category.router';
import GroupRouter from './Router/group.router';
import UserRouter from './Router/user.router';
dotenv.config();

const app : Application = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use('/api/auth', AuthRouter);
app.use('/api/expense', ExpenseRouter);
app.use('/api/category', CategoryRouter);
app.use('/api/group', GroupRouter);
app.use('/api/user', UserRouter);


app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

const PORT: number = Number(process.env.PORT) || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

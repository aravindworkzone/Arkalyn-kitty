import express, {Application, Request, Response} from 'express';
import connectDB from './DB/connection';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import AuthRouter from './router/auth.router';
import ExpenseRouter from './router/expense.router';
import CategoryRouter from './router/category.router';
import GroupRouter from './router/group.router';
import ReportRouter from './router/report.router';
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
app.use('/api/report', ReportRouter);


app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

const PORT: number = Number(process.env.PORT) || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

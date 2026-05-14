import { Routes, Route } from 'react-router-dom'
import { Login, Registration } from './page/Authentication'
import LandingPage from './page/landingPage'
import GroupPage from './page/GroupPage'
import CreateGroupPage from './page/CreateGroupPage'
import GroupDetailPage from './page/GroupDetailPage'
import CreateCategory from './page/CreateCategory'
import CreateExpense from './page/CreateExpense'
import Report from './page/GroupReport'
import AllExpensesPage from './page/AllExpensesPage'
import AllCreditsPage from './page/AllCreditsPage'
import CategoryReportPage from './page/CategoryReportPage'
import ProtectedRouter from './components/ProtectedRouter'
import ErrorBoundary from './components/ErrorBoundary'
import NotFoundPage from './page/NotFoundPage'
import UseSocket from './hooks/socket'

function App() {
  return (
    <ErrorBoundary>
      <UseSocket />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />

        <Route element={<ProtectedRouter />}>
          <Route path="/groups" element={<GroupPage />} />
          <Route path="/groups/new" element={<CreateGroupPage />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
          <Route path="/groups/:groupId/expenses" element={<AllExpensesPage />} />
          <Route path="/groups/:groupId/expenses/new" element={<CreateExpense />} />
          <Route path="/groups/:groupId/categories/new" element={<CreateCategory />} />
          <Route path="/groups/:groupId/activity" element={<Report />} />
          <Route path="/groups/:groupId/credits" element={<AllCreditsPage />} />
          <Route path="/groups/:groupId/reports/categories" element={<CategoryReportPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App

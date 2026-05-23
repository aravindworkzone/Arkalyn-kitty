import { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Login, Registration } from './page/Authentication'
import ForgotPasswordPage from './page/ForgotPasswordPage'
import ResetPasswordPage from './page/ResetPasswordPage'
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
import ShortcutHelp from './components/ShortcutHelp'
import UseSocket from './hooks/socket'
import useGlobalShortcuts from './hooks/useGlobalShortcuts'
import TourProvider from './tour/TourProvider'

function App() {
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const openHelp = useCallback(() => setShortcutHelpOpen(true), [])
  useGlobalShortcuts(openHelp)

  return (
    <ErrorBoundary>
      <UseSocket />
      <ShortcutHelp isOpen={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
      <TourProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

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
      </TourProvider>
    </ErrorBoundary>
  )
}

export default App

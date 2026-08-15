import { useState, useCallback, lazy, Suspense } from 'react'
import { Analytics } from '@vercel/analytics/react';
import { Routes, Route, useLocation } from 'react-router-dom'
import { Login, Registration } from './page/Authentication'
import ForgotPasswordPage from './page/ForgotPasswordPage'
import ResetPasswordPage from './page/ResetPasswordPage'
import LandingPage from './page/landingPage'
import GroupPage from './page/GroupPage'
import CreateGroupPage from './page/CreateGroupPage'
import GroupDetailPage from './page/GroupDetailPage'
import GroupManagementPage from './page/GroupManagementPage'
import CreateCategory from './page/CreateCategory'
import CreateExpense from './page/CreateExpense'
import Report from './page/GroupReport'
import AllExpensesPage from './page/AllExpensesPage'
import AllCreditsPage from './page/AllCreditsPage'
import CategoryReportPage from './page/CategoryReportPage'
import PricingPage from './page/PricingPage'
import SubscriptionPlansPage from './page/SubscriptionPlansPage'
import ProfilePage from './page/ProfilePage'
import NotificationsPage from './page/NotificationsPage'
import AdminDashboard from './page/admin/AdminDashboard'
import AdminRoute from './components/AdminRoute'
import ProtectedRouter from './components/ProtectedRouter'
import AppLayout from './components/AppLayout'
import RouteFade from './components/RouteFade'
import ErrorBoundary from './components/ErrorBoundary'
import TopProgressBar from './components/TopProgressBar'
import NotFoundPage from './page/NotFoundPage'
import ShortcutHelp from './components/ShortcutHelp'
import UseSocket from './hooks/socket'
import useGlobalShortcuts from './hooks/useGlobalShortcuts'

// Design-system isolation harness. `import.meta.env.DEV` is statically replaced
// at build time, so the whole branch — and the dynamic import with it — is
// dead-code-eliminated from the production bundle.
const Showcase = import.meta.env.DEV ? lazy(() => import('./page/dev/Showcase')) : null

function App() {
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const openHelp = useCallback(() => setShortcutHelpOpen(true), [])
  useGlobalShortcuts(openHelp)
  const location = useLocation()

  return (
    <>
    <ErrorBoundary>
      <TopProgressBar />
      <UseSocket />
      <ShortcutHelp isOpen={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
      {/* The per-navigation fade lives in RouteFade / AppLayout now, not in a
          keyed wrapper around everything — that key remounted the whole tree,
          and the sidebar is part of that tree. */}
      <Routes location={location}>
        <Route element={<RouteFade />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/plans" element={<SubscriptionPlansPage />} />
        </Route>

        <Route element={<ProtectedRouter />}>
          {/* AppLayout owns the sidebar, the mobile header and the content
              offset, so every authenticated screen sits inside it. */}
          <Route element={<AppLayout />}>
            <Route path="/groups" element={<GroupPage />} />
            <Route path="/groups/new" element={<CreateGroupPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/groups/:groupId/manage" element={<GroupManagementPage />} />
            <Route path="/groups/:groupId/expenses" element={<AllExpensesPage />} />
            <Route path="/groups/:groupId/expenses/new" element={<CreateExpense />} />
            <Route path="/groups/:groupId/expenses/:expenseId/edit" element={<CreateExpense />} />
            <Route path="/groups/:groupId/categories/new" element={<CreateCategory />} />
            <Route path="/groups/:groupId/activity" element={<Report />} />
            <Route path="/groups/:groupId/credits" element={<AllCreditsPage />} />
            <Route path="/groups/:groupId/reports/categories" element={<CategoryReportPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
          </Route>
        </Route>

        {Showcase && (
          <Route
            path="/dev/showcase"
            element={
              <Suspense fallback={null}>
                <Showcase />
              </Suspense>
            }
          />
        )}

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
    <Analytics />
    </>
  )
}

export default App

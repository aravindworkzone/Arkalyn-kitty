import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
// Analytics is no longer the raw @vercel/analytics component — it is the
// consent-gated wrapper, which is the only place a tracker may be loaded from.
import { CookieConsentBanner, Analytics } from './components/consent'
import { Login, Registration } from './page/Authentication'
import ForgotPasswordPage from './page/ForgotPasswordPage'
import ResetPasswordPage from './page/ResetPasswordPage'
import LandingPage from './page/landingPage'
import GroupPage from './page/GroupPage'
import CreateGroupPage from './page/CreateGroupPage'
import GroupDetailPage from './page/GroupDetailPage'
import GroupManagementPage from './page/GroupManagementPage'
import GroupConnectionsPage from './page/GroupConnectionsPage'
import ChitLayout from './components/chit/ChitLayout'
import MyChitPage from './page/chit/MyChitPage'
import ChitCyclesPage from './page/chit/ChitCyclesPage'
import ChitCollectionPage from './page/chit/ChitCollectionPage'
import ChitSetupPage from './page/ChitSetupPage'
import JoinGroupPage from './page/JoinGroupPage'
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

  // Registered for every visitor, signed in or not — the worker itself is inert
  // until something subscribes, and having it ready is what lets the push
  // subscription resolve immediately once someone signs in. The empty dependency
  // array matters: without it this re-registered on every single render.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.error('Service worker registration failed', err))
  }, [])

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
            {/* Sits inside the auth guard so a signed-out visitor is sent to
                /login and returned here afterwards, carrying a real account
                into the request. */}
            <Route path="/join/:token" element={<JoinGroupPage />} />
            <Route path="/groups" element={<GroupPage />} />
            <Route path="/groups/new" element={<CreateGroupPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/groups/:groupId/manage" element={<GroupManagementPage />} />
            <Route path="/groups/:groupId/connections" element={<GroupConnectionsPage />} />
            {/* The chit board is three pages under one shell. ChitLayout owns the
                board query and the scheme-wide notices; each child renders one
                section. /chit/setup stays a sibling — it is a full-page form, not
                a section of the board, and has no matching child here so it falls
                through to its own route below. */}
            <Route path="/groups/:groupId/chit" element={<ChitLayout />}>
              <Route index element={<MyChitPage />} />
              <Route path="cycles" element={<ChitCyclesPage />} />
              <Route path="collection" element={<ChitCollectionPage />} />
            </Route>
            <Route path="/groups/:groupId/chit/setup" element={<ChitSetupPage />} />
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
    {/* Order is deliberate: the banner boots the consent library, and Analytics
        listens for the events it emits. */}
    <CookieConsentBanner />
    <Analytics />
    </>
  )
}

export default App

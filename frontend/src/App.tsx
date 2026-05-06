import React from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { Login, Registration } from './page/Authentication'
import GroupPage from './page/GroupPage'
import CreateGroupPage from './page/CreateGroupPage'
import GroupDetailPage from './page/GroupDetailPage'
import CreateCategory from './page/CreateCategory'
import CreateExpense from './page/CreateExpense'
import Report from './page/GroupReport'
import AllExpensesPage from './page/AllExpensesPage'
import ProtectedRouter from './components/ProtectedRouter'
function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />
        <Route path="/" element={<Navigate to="/groups" replace />} />

        <Route element={<ProtectedRouter />}>
          <Route path="/groups" element={<GroupPage />} />
          <Route path="/groups/create" element={<CreateGroupPage />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
          <Route path="/groups/:groupId/create-expense" element={<CreateExpense />} />
          <Route path="/groups/:groupId/create-category" element={<CreateCategory />} />
          <Route path="/groups/:groupId/report" element={<Report />} />
          <Route path="/groups/:groupId/expenses" element={<AllExpensesPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App

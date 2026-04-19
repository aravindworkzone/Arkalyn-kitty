import React from 'react'
import { Link } from 'react-router-dom'
const GroupDetailPage = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold underline">
                Group Detail page
            </h1>
            <Link to="/groups/:groupId/expense">Create Expense</Link>
            <Link to="/groups/:groupId/category">Create Category</Link>
            <Link to="/groups/:groupId/report">Create Report</Link>
        </div>
    )
}

export default GroupDetailPage
import React from 'react'
import { Link } from 'react-router-dom'
const GroupPage = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold underline">
                Group page
            </h1>
            <Link to="/groups/create">Create Group</Link>
            <Link to="/groups/:groupId">Group Detail</Link>
        </div>
    )
}

export default GroupPage
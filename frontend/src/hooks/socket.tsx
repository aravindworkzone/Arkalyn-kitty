import React from 'react'
import ConnectSocket from '../socket/listener/validateConnect.socket'
import ExpenseListener from '../socket/listener/expense.listener'
import CategoryListener from '../socket/listener/category.listener'

export default function useSocket() {
    return (
        <>
            <ConnectSocket />
            <ExpenseListener />
            <CategoryListener />
        </>
    )
}
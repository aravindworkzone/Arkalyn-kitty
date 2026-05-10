import ConnectSocket from '../socket/listener/validateConnect.socket'
import ExpenseListener from '../socket/listener/expense.listener'
import CategoryListener from '../socket/listener/category.listener'
import GroupListener from '../socket/listener/group.listener'

export default function useSocket() {
    return (
        <>
            <ConnectSocket />
            <ExpenseListener />
            <CategoryListener />
            <GroupListener />
        </>
    )
}
export const toDBAmount = (amount: number) => Math.round(amount * 100);

export const fromDBAmount = (amount: number) => Math.round(amount / 100);
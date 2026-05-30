export const toDBAmount = (amount: number) => parseFloat((amount * 100).toFixed(2));

export const fromDBAmount = (amount: number) => parseFloat((amount / 100).toFixed(2));
export const toDBAmount = (amount: number) => Math.round(amount * 100);

export const fromDBAmount = (amount: number) => parseFloat((amount / 100).toFixed(2));
// Dynamically loads the Razorpay Checkout script and opens the hosted modal.
// The script is fetched once and cached on window.Razorpay.

const SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loaderPromise: Promise<boolean> | null = null;

export interface RazorpaySuccess {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

export interface RazorpayFailure {
    error?: { description?: string; reason?: string; metadata?: { order_id?: string; payment_id?: string } };
}

export interface RazorpayOptions {
    key: string;
    amount: number; // paise
    currency: string;
    name: string;
    description?: string;
    order_id: string;
    handler: (res: RazorpaySuccess) => void;
    prefill?: { name?: string; email?: string };
    notes?: Record<string, string>;
    theme?: { color?: string };
    modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
    open: () => void;
    on: (event: string, cb: (resp: RazorpayFailure) => void) => void;
}

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    }
}

export const loadRazorpay = (): Promise<boolean> => {
    if (window.Razorpay) return Promise.resolve(true);
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise<boolean>((resolve) => {
        const script = document.createElement("script");
        script.src = SRC;
        script.onload = () => resolve(true);
        script.onerror = () => {
            loaderPromise = null;
            resolve(false);
        };
        document.body.appendChild(script);
    });

    return loaderPromise;
};

export const openRazorpayCheckout = (
    options: RazorpayOptions,
    onFailed?: (resp: RazorpayFailure) => void,
): boolean => {
    if (!window.Razorpay) return false;
    const rzp = new window.Razorpay(options);
    if (onFailed) rzp.on("payment.failed", onFailed);
    rzp.open();
    return true;
};

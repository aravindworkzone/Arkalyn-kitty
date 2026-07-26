const GoogleButton = () => {
    // The backend owns the whole handshake: it mints the anti-CSRF `state` into
    // an HttpOnly cookie (which this page could neither set nor read) and builds
    // the consent URL from its own client id and redirect URI, so the two can't
    // drift apart. All this button does is leave.
    const startUrl = `${import.meta.env.VITE_API_URL}auth/oauth/start`;
    return (
        <button
        className="flex w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-black-500 to-gray-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-[#3367D6] hover:shadow-lg active:scale-[0.98]"
        type="button"
        onClick={() => {
            window.location.href = startUrl;
        }}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="h-5 w-5"
            >
                <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.5-.4-3.5z"
                />
                <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.2 19 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"
                />
                <path
                fill="#4CAF50"
                d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2c-2.1 1.5-4.7 2.4-7.3 2.4-5.3 0-9.8-3.3-11.4-8l-6.5 5C9.4 39.5 16.2 44 24 44z"
                />
                <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.4 5.4-6.2 6.8l6.2 5.2C39.3 36.2 44 30.7 44 24c0-1.3-.1-2.5-.4-3.5z"
                />
            </svg>

            <span>Continue with Google</span>
        </button>
    )
}

export default GoogleButton;
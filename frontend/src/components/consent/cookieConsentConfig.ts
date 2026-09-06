import type { CookieConsentConfig, Translation } from "vanilla-cookieconsent";

/**
 * Single source of truth for the consent UI: the categories, the copy, and the
 * cookies each category is allowed to set.
 *
 * `mode` stays on the library default (opt-in), which is the GDPR-relevant
 * half: nothing outside `necessary` runs until the visitor actively accepts.
 * `autoClear` is the other half — when a category is switched back off the
 * library erases the cookies listed here, so withdrawing consent removes the
 * data as well as the script.
 *
 * The cookie tables list this app's real cookies (see backend/config/constants.ts).
 * Keep them truthful: a consent notice that misdescribes what it sets is worse
 * than none.
 */

const en: Translation = {
    consentModal: {
        title: "We use cookies",
        description:
            "We use cookies that are necessary to sign you in and keep the app working. " +
            "With your permission we would also like to use analytics cookies to understand " +
            "how the app is used, and marketing cookies to measure our campaigns. " +
            "You can accept all, reject everything optional, or choose per category.",
        acceptAllBtn: "Accept all",
        acceptNecessaryBtn: "Reject all",
        showPreferencesBtn: "Manage preferences",
        closeIconLabel: "Reject all and close",
    },
    preferencesModal: {
        title: "Cookie preferences",
        acceptAllBtn: "Accept all",
        acceptNecessaryBtn: "Reject all",
        savePreferencesBtn: "Save my choices",
        closeIconLabel: "Close",
        serviceCounterLabel: "Service|Services",
        sections: [
            {
                title: "How we use cookies",
                description:
                    "Choose which categories you allow. You can change this at any time from " +
                    "the Cookie settings link in the footer.",
            },
            {
                title: "Strictly necessary",
                description:
                    "Required for the app to work: keeping you signed in, protecting the " +
                    "sign-in flow, and remembering this consent choice. These cannot be " +
                    "switched off.",
                linkedCategory: "necessary",
                cookieTable: {
                    headers: { name: "Cookie", description: "Purpose", duration: "Expires" },
                    body: [
                        {
                            name: "accessToken",
                            description: "Keeps you signed in between requests.",
                            duration: "Session",
                        },
                        {
                            name: "refreshToken",
                            description: "Renews your session without a fresh sign-in.",
                            duration: "Session",
                        },
                        {
                            name: "oauthState",
                            description: "Protects the Google sign-in flow against CSRF.",
                            duration: "Minutes",
                        },
                        {
                            name: "cc_cookie",
                            description: "Remembers the cookie choices you made here.",
                            duration: "6 months",
                        },
                    ],
                },
            },
            {
                title: "Analytics",
                description:
                    "Anonymous usage statistics - which screens are opened and how often - " +
                    "so we can see what to improve. Nothing here is used to identify you.",
                linkedCategory: "analytics",
                cookieTable: {
                    headers: { name: "Cookie", description: "Purpose", duration: "Expires" },
                    body: [
                        {
                            name: "_ga, _ga_*",
                            description: "Google Analytics - distinguishes visitors.",
                            duration: "2 years",
                        },
                        {
                            name: "_gid",
                            description: "Google Analytics - distinguishes visitors.",
                            duration: "24 hours",
                        },
                    ],
                },
            },
            {
                title: "Marketing",
                description:
                    "Used to measure our campaigns and show relevant ads. We do not run any " +
                    "marketing scripts today - leaving this off keeps it that way.",
                linkedCategory: "marketing",
            },
        ],
    },
};

const ta: Translation = {
    consentModal: {
        title: "நாங்கள் குக்கீகளைப் பயன்படுத்துகிறோம்",
        description:
            "உங்களை உள்நுழையச் செய்யவும் செயலியை இயங்க வைக்கவும் தேவையான " +
            "குக்கீகளை நாங்கள் பயன்படுத்துகிறோம். உங்கள் அனுமதியுடன், " +
            "செயலி எவ்வாறு பயன்படுத்தப்படுகிறது என்பதை அறிய " +
            "பகுப்பாய்வு குக்கீகளையும், எங்கள் விளம்பரங்களை அளவிட " +
            "சந்தைப்படுத்தல் குக்கீகளையும் பயன்படுத்த விரும்புகிறோம்.",
        acceptAllBtn: "அனைத்தையும் ஏற்கவும்",
        acceptNecessaryBtn: "அனைத்தையும் நிராகரி",
        showPreferencesBtn: "விருப்பங்களை நிர்வகி",
        closeIconLabel: "நிராகரித்து மூடு",
    },
    preferencesModal: {
        title: "குக்கீ விருப்பங்கள்",
        acceptAllBtn: "அனைத்தையும் ஏற்கவும்",
        acceptNecessaryBtn: "அனைத்தையும் நிராகரி",
        savePreferencesBtn: "எனது தேர்வுகளைச் சேமி",
        closeIconLabel: "மூடு",
        serviceCounterLabel: "சேவை|சேவைகள்",
        sections: [
            {
                title: "குக்கீகளை நாங்கள் எவ்வாறு பயன்படுத்துகிறோம்",
                description:
                    "நீங்கள் அனுமதிக்கும் வகைகளைத் தேர்ந்தெடுக்கவும். கீழே உள்ள " +
                    "குக்கீ அமைப்புகள் இணைப்பிலிருந்து எப்போது வேண்டுமானாலும் " +
                    "இதை மாற்றலாம்.",
            },
            {
                title: "கண்டிப்பாகத் தேவையானவை",
                description:
                    "செயலி இயங்கத் தேவையானவை: உங்களை உள்நுழைந்த நிலையில் " +
                    "வைத்திருத்தல், உள்நுழைவைப் பாதுகாத்தல், இந்தத் தேர்வை " +
                    "நினைவில் வைத்தல். இவற்றை அணைக்க முடியாது.",
                linkedCategory: "necessary",
            },
            {
                title: "பகுப்பாய்வு",
                description:
                    "எந்தத் திரைகள் எத்தனை முறை திறக்கப்படுகின்றன என்பது " +
                    "போன்ற அடையாளம் தெரியாத புள்ளிவிவரங்கள். இவை உங்களை " +
                    "அடையாளம் காண பயன்படுத்தப்படுவதில்லை.",
                linkedCategory: "analytics",
            },
            {
                title: "சந்தைப்படுத்தல்",
                description:
                    "எங்கள் விளம்பரங்களை அளவிடவும் பொருத்தமான " +
                    "விளம்பரங்களைக் காட்டவும். இன்று எந்த சந்தைப்படுத்தல் " +
                    "ஸ்க்ரிப்டையும் நாங்கள் இயக்கவில்லை.",
                linkedCategory: "marketing",
            },
        ],
    },
};

export const cookieConsentConfig: CookieConsentConfig = {
    guiOptions: {
        // `equalWeightButtons` is deliberate, not cosmetic: a visually louder
        // "Accept all" than "Reject all" is treated as invalid consent.
        consentModal: { layout: "box", position: "bottom left", equalWeightButtons: true },
        preferencesModal: { layout: "box", equalWeightButtons: true },
    },

    categories: {
        necessary: {
            enabled: true,
            readOnly: true,
        },
        analytics: {
            autoClear: {
                cookies: [{ name: /^_ga/ }, { name: "_gid" }, { name: /^_gat/ }],
            },
        },
        marketing: {
            // Nothing sets marketing cookies yet. When something does, list it
            // here so turning the category off actually erases it.
            autoClear: { cookies: [] },
        },
    },

    // `default` is replaced at run time with the active i18next language — see
    // CookieConsentBanner.
    language: {
        default: "en",
        translations: { en, ta },
    },
};

export default cookieConsentConfig;

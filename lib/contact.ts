/** Phone number students call or WhatsApp to get login credentials. Digits only, with country code. */
export const CONTACT_PHONE = "916201111877";

/** Human-friendly version shown on screen. */
export const CONTACT_PHONE_DISPLAY = "+91 62011 11877";

export const WHATSAPP_MESSAGE = "Hi! 👋 Mujhe bhi topper arc chahiye 😎 I want to join the Champ Test Series. Please share my login ID and password.";

export const callHref = `tel:+${CONTACT_PHONE}`;
export const whatsappHref = `https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

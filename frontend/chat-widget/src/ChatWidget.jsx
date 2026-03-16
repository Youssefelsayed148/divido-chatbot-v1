import { useState, useRef, useEffect } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.DEV ? "http://localhost:8000" : "/api";
const CONTEXT  = "website";

const getLanguage = () => {
  try {
    const lang = localStorage.getItem("i18nextLng");
    if (lang && lang.startsWith("ar")) return "ar";
    return "en";
  } catch { return "en"; }
};

const detectArabic = (text) => {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicChars / text.length > 0.3;
};

const T = {
  en: {
    headerName:        "Divido Assistant",
    headerStatus:      "Online · Real Estate Investment Guide",
    welcomeText:       "Hello! I'm **Divido's AI Assistant**.\n\nI can help you understand the platform, explore investment opportunities, and answer your questions about fractional real estate.",
    placeholder:       "Ask anything about Divido…",
    footer:            "Powered by",
    footerBrand:       "Divido AI",
    footerSub:         "· Grounded in official content",
    startConversation: "Start of conversation",
    contactCardTitle:  "Reach us directly",
    leadFormTitle:     "Get in Touch",
    leadFormSubtitle:  "Our team will contact you shortly",
    leadName:          "Full Name",
    leadNamePH:        "Enter your full name",
    leadEmail:         "Email Address",
    leadEmailPH:       "Enter your email",
    leadPhone:         "Phone Number",
    leadPhonePH:       "Optional",
    leadSubmit:        "Send Message",
    leadSubmitting:    "Sending…",
    leadSuccess:       "✅ Thank you! A member of the **Divido team** will contact you as soon as possible.\n\nIs there anything else I can help you with?",
    errorConnect:      "I'm having trouble connecting right now. Please try again in a moment.",
    errorForm:         "Something went wrong. Please try again.",
    errorConnect2:     "Connection error. Please try again.",
    nameRequired:      "Please enter your name and email address.",
    contactSupport:    "Contact Support",
  },
  ar: {
    headerName:        "مساعد ديفيدو",
    headerStatus:      "متاح · دليل الاستثمار العقاري",
    welcomeText:       "مرحباً! أنا **مساعد ديفيدو الذكي**.\n\nيمكنني مساعدتك في فهم المنصة، واستكشاف فرص الاستثمار، والإجابة على أسئلتك حول العقارات التجزيئية.",
    placeholder:       "اسألني أي شيء عن ديفيدو…",
    footer:            "مدعوم بواسطة",
    footerBrand:       "ديفيدو AI",
    footerSub:         "· مستند إلى المحتوى الرسمي",
    startConversation: "بداية المحادثة",
    contactCardTitle:  "تواصل معنا مباشرة",
    leadFormTitle:     "تواصل معنا",
    leadFormSubtitle:  "سيتواصل معك فريقنا قريباً",
    leadName:          "الاسم الكامل",
    leadNamePH:        "أدخل اسمك الكامل",
    leadEmail:         "البريد الإلكتروني",
    leadEmailPH:       "أدخل بريدك الإلكتروني",
    leadPhone:         "رقم الهاتف",
    leadPhonePH:       "اختياري",
    leadSubmit:        "إرسال الرسالة",
    leadSubmitting:    "جارٍ الإرسال…",
    leadSuccess:       "✅ شكراً لك! سيتواصل معك أحد أعضاء فريق **ديفيدو** في أقرب وقت ممكن.\n\nهل هناك أي شيء آخر يمكنني مساعدتك به؟",
    errorConnect:      "أواجه مشكلة في الاتصال الآن. يرجى المحاولة مرة أخرى.",
    errorForm:         "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    errorConnect2:     "خطأ في الاتصال. يرجى المحاولة مرة أخرى.",
    nameRequired:      "يرجى إدخال الاسم والبريد الإلكتروني.",
    contactSupport:    "تواصل مع الدعم",
  }
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=Outfit:wght@300;400;500;600&family=Cairo:wght@400;500;600;700&display=swap');

  .dv * { box-sizing: border-box; margin: 0; padding: 0; }
  .dv { font-family: 'Outfit', system-ui, sans-serif; }

  .dv-bubble {
    position: fixed; bottom: 28px; right: 28px;
    width: 62px; height: 62px; border-radius: 50%;
    background: linear-gradient(145deg, #FF6B2B, #E84E0F);
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 24px rgba(255,107,43,0.45), 0 2px 6px rgba(0,0,0,0.15);
    transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
    z-index: 99998;
  }
  .dv-bubble:hover { transform: scale(1.1) translateY(-2px); box-shadow: 0 10px 32px rgba(255,107,43,0.55); }
  .dv-bubble.open  { transform: scale(0.94); }
  .dv-notif {
    position: absolute; top: 3px; right: 3px;
    width: 13px; height: 13px;
    background: #1A1A1A; border-radius: 50%;
    border: 2.5px solid #fff; animation: dv-pop 2.5s infinite;
  }
  @keyframes dv-pop { 0%,100% { transform: scale(1); } 50% { transform: scale(1.25); } }

  .dv-panel {
    position: fixed; bottom: 102px; right: 28px;
    width: 390px; height: 590px;
    background: #FAFAF9; border-radius: 20px;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(255,107,43,0.08);
    display: flex; flex-direction: column;
    overflow: hidden; z-index: 99997;
    transform-origin: bottom right;
    animation: dv-slide 0.28s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes dv-slide {
    from { transform: scale(0.88) translateY(16px); opacity: 0; }
    to   { transform: scale(1) translateY(0); opacity: 1; }
  }

  .dv-header {
    background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%);
    padding: 16px 18px; display: flex; align-items: center; gap: 12px;
    flex-shrink: 0; position: relative; overflow: hidden;
  }
  .dv-header::before {
    content: ''; position: absolute; top: -20px; right: -20px;
    width: 80px; height: 80px;
    background: radial-gradient(circle, rgba(255,107,43,0.25), transparent 70%);
    border-radius: 50%;
  }
  .dv-avatar {
    width: 42px; height: 42px; border-radius: 12px;
    background: linear-gradient(135deg, #FF6B2B, #E84E0F);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    font-family: 'Syne', serif; font-size: 17px; font-weight: 700; color: #fff;
    box-shadow: 0 4px 12px rgba(255,107,43,0.4);
  }
  .dv-header-info { flex: 1; }
  .dv-header-name { font-family: 'Syne', serif; font-size: 15px; font-weight: 700; color: #fff; }
  .dv-header-sub  { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
  .dv-online-dot  { width: 6px; height: 6px; background: #4ADE80; border-radius: 50%; box-shadow: 0 0 6px rgba(74,222,128,0.6); animation: dv-breathe 2s infinite; }
  @keyframes dv-breathe { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .dv-header-status { font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 300; }
  .dv-close { background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.6); cursor: pointer; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .dv-close:hover { background: rgba(255,107,43,0.3); color: #fff; }

  .dv-messages { flex: 1; overflow-y: auto; padding: 18px 14px; display: flex; flex-direction: column; gap: 16px; scroll-behavior: smooth; background: radial-gradient(ellipse at top right, rgba(255,107,43,0.04), transparent 60%), #FAFAF9; }
  .dv-messages::-webkit-scrollbar { width: 3px; }
  .dv-messages::-webkit-scrollbar-thumb { background: rgba(255,107,43,0.25); border-radius: 2px; }

  .dv-row { display: flex; flex-direction: column; gap: 7px; }
  .dv-row.bot  { align-items: flex-start; }
  .dv-row.user { align-items: flex-end; }
  .dv-row-inner { display: flex; align-items: flex-end; gap: 8px; }
  .dv-row.user .dv-row-inner { flex-direction: row-reverse; }
  .dv-bot-icon { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #FF6B2B, #E84E0F); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 13px; font-weight: 700; color: #fff; font-family: 'Syne', serif; margin-bottom: 2px; }
  .dv-bubble-msg { max-width: 78%; padding: 12px 15px; border-radius: 16px; font-size: 13.5px; line-height: 1.65; }
  .dv-row.bot .dv-bubble-msg { background: #FFFFFF; color: #1A1A1A; border: 1px solid rgba(0,0,0,0.08); border-bottom-left-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); line-height: 1.7; }
  .dv-row.user .dv-bubble-msg { background: linear-gradient(135deg, #FF6B2B, #E84E0F); color: #fff; border-bottom-right-radius: 4px; box-shadow: 0 4px 14px rgba(255,107,43,0.35); font-weight: 500; }

  .dv-cursor { display: inline-block; color: #FF6B2B; font-weight: 700; animation: dv-blink 0.7s infinite; margin-left: 2px; }
  @keyframes dv-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }

  .dv-md h1,.dv-md h2,.dv-md h3 { font-family: 'Syne', serif; color: #1A1A1A; line-height: 1.3; }
  .dv-md h1 { font-size: 15px; font-weight: 700; margin: 14px 0 6px; }
  .dv-md h2 { font-size: 14px; font-weight: 700; margin: 12px 0 6px; padding-bottom: 5px; border-bottom: 2px solid rgba(255,107,43,0.2); }
  .dv-md h3 { font-size: 13.5px; font-weight: 700; color: #FF6B2B; margin: 10px 0 4px; }
  .dv-md p  { margin: 6px 0; color: #222; line-height: 1.7; }
  .dv-md p:first-child { margin-top: 0; } .dv-md p:last-child { margin-bottom: 0; }
  .dv-md strong { font-weight: 700; color: #1A1A1A; background: rgba(255,107,43,0.08); padding: 0 3px; border-radius: 3px; }
  .dv-md em { font-style: italic; color: #555; }
  .dv-md ul { list-style: none; padding-left: 0; margin: 8px 0; display: flex; flex-direction: column; gap: 5px; }
  .dv-md ul li { position: relative; padding: 6px 10px 6px 22px; color: #222; background: #fafafa; border-radius: 7px; line-height: 1.6; border-left: 2px solid rgba(255,107,43,0.3); }
  .dv-md ul li::before { content: ''; position: absolute; left: 8px; top: 13px; width: 6px; height: 6px; background: #FF6B2B; border-radius: 50%; }
  .dv-md ol { padding-left: 0; margin: 8px 0; list-style: none; counter-reset: dv-counter; display: flex; flex-direction: column; gap: 6px; }
  .dv-md ol li { counter-increment: dv-counter; display: flex; gap: 10px; align-items: flex-start; padding: 9px 12px; background: rgba(255,107,43,0.05); border-radius: 9px; color: #222; line-height: 1.6; border: 1px solid rgba(255,107,43,0.1); }
  .dv-md ol li::before { content: counter(dv-counter); min-width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #FF6B2B, #E84E0F); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(255,107,43,0.3); }
  .dv-md code { background: rgba(255,107,43,0.08); color: #E84E0F; font-family: monospace; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  .dv-md blockquote { border-left: 3px solid #FF6B2B; padding: 8px 14px; margin: 10px 0; background: rgba(255,107,43,0.05); border-radius: 0 9px 9px 0; color: #555; font-style: italic; }
  .dv-md hr { border: none; border-top: 1.5px solid rgba(0,0,0,0.08); margin: 10px 0; }

  .dv-md.ar { font-family: 'Cairo', system-ui, sans-serif; direction: rtl; text-align: right; line-height: 2; font-size: 14px; }
  .dv-md.ar h2 { border-bottom: none; border-right: 3px solid rgba(255,107,43,0.4); padding-right: 10px; padding-bottom: 0; }
  .dv-md.ar ul li { padding: 6px 22px 6px 10px; border-left: none; border-right: 2px solid rgba(255,107,43,0.3); }
  .dv-md.ar ul li::before { left: auto; right: 8px; }
  .dv-md.ar ol li { flex-direction: row-reverse; }
  .dv-md.ar blockquote { border-left: none; border-right: 3px solid #FF6B2B; padding: 8px 14px 8px 8px; border-radius: 9px 0 0 9px; }

  .dv-btns { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 2px; max-width: 88%; }
  .dv-btn { background: #fff; border: 1.5px solid rgba(255,107,43,0.3); color: #FF6B2B; padding: 6px 13px; border-radius: 20px; font-size: 12px; font-family: 'Outfit', sans-serif; cursor: pointer; font-weight: 500; transition: all 0.15s; white-space: nowrap; box-shadow: 0 2px 6px rgba(255,107,43,0.08); }
  .dv-btn:hover { background: linear-gradient(135deg, #FF6B2B, #E84E0F); border-color: transparent; color: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,107,43,0.35); }
  .dv-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .dv-btn.support { background: rgba(255,107,43,0.06); border-color: rgba(255,107,43,0.45); font-weight: 600; }

  .dv-time { font-size: 10px; color: #BBBBBB; font-weight: 300; padding: 0 4px; }

  .dv-typing { display: flex; align-items: center; gap: 4px; padding: 12px 16px; background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 16px; border-bottom-left-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); width: fit-content; }
  .dv-typing span { width: 5px; height: 5px; background: #FF6B2B; border-radius: 50%; animation: dv-bounce 1.2s infinite; opacity: 0.6; }
  .dv-typing span:nth-child(2) { animation-delay: 0.15s; }
  .dv-typing span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes dv-bounce { 0%,80%,100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-5px); opacity: 1; } }

  .dv-divider { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .dv-divider-line { flex: 1; height: 1px; background: rgba(0,0,0,0.07); }
  .dv-divider-text { font-size: 10px; color: #BBBBBB; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }

  .dv-input-wrap { padding: 12px 14px 14px; background: #fff; border-top: 1px solid rgba(0,0,0,0.07); flex-shrink: 0; }
  .dv-input-box { display: flex; align-items: flex-end; gap: 8px; background: #F5F4F2; border: 1.5px solid rgba(0,0,0,0.08); border-radius: 14px; padding: 9px 9px 9px 14px; transition: border-color 0.15s, box-shadow 0.15s; }
  .dv-input-box:focus-within { border-color: rgba(255,107,43,0.5); box-shadow: 0 0 0 3px rgba(255,107,43,0.08); background: #fff; }
  .dv-input { flex: 1; background: none; border: none; outline: none; color: #1A1A1A; font-family: 'Outfit', sans-serif; font-size: 13.5px; resize: none; min-height: 20px; max-height: 90px; line-height: 1.5; padding: 0; }
  .dv-input::placeholder { color: #AAAAAA; }
  .dv-send { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #FF6B2B, #E84E0F); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s; box-shadow: 0 3px 10px rgba(255,107,43,0.35); }
  .dv-send:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
  .dv-send:not(:disabled):hover { transform: scale(1.06) translateY(-1px); box-shadow: 0 5px 14px rgba(255,107,43,0.45); }
  .dv-footer { text-align: center; font-size: 10px; color: #CCCCCC; margin-top: 7px; letter-spacing: 0.04em; }
  .dv-footer span { color: #FF6B2B; font-weight: 500; }

  .dv-contact-card { background: linear-gradient(135deg, rgba(255,107,43,0.06), rgba(255,107,43,0.02)); border: 1.5px solid rgba(255,107,43,0.2); border-radius: 12px; padding: 12px 14px; margin-top: 8px; max-width: 78%; margin-left: 36px; }
  .dv-contact-card-title { font-size: 11px; font-weight: 600; color: #FF6B2B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  .dv-contact-item { display: flex; align-items: center; gap: 8px; margin: 5px 0; }
  .dv-contact-icon { width: 26px; height: 26px; border-radius: 7px; background: linear-gradient(135deg, #FF6B2B, #E84E0F); display: flex; align-items: center; justify-content: center; }
  .dv-contact-text { font-size: 12.5px; color: #1A1A1A; font-weight: 500; }

  /* ── Lead Form ── */
  .dv-lead-form { background: #fff; border: 1.5px solid rgba(255,107,43,0.15); border-radius: 18px; margin-top: 8px; max-width: 92%; margin-left: 36px; box-shadow: 0 8px 32px rgba(255,107,43,0.12), 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; }
  .dv-lead-form.rtl { margin-left: 0; margin-right: 0; direction: rtl; max-width: 98%; width: 98%; }
  .dv-lead-form-header { background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%); padding: 14px 16px; display: flex; align-items: center; gap: 11px; position: relative; overflow: hidden; }
  .dv-lead-form-header::after { content: ''; position: absolute; top: -15px; right: -15px; width: 60px; height: 60px; background: radial-gradient(circle, rgba(255,107,43,0.3), transparent 70%); border-radius: 50%; }
  .dv-lead-form-icon { width: 38px; height: 38px; border-radius: 11px; background: linear-gradient(135deg, #FF6B2B, #E84E0F); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(255,107,43,0.4); }
  .dv-lead-form-title    { font-family: 'Syne', serif; font-size: 14px; font-weight: 700; color: #fff; }
  .dv-lead-form-subtitle { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
  .dv-lead-form.rtl .dv-lead-form-title,
  .dv-lead-form.rtl .dv-lead-form-subtitle { font-family: 'Cairo', sans-serif; text-align: right; }
  .dv-lead-fields  { padding: 16px 16px 4px; }
  .dv-lead-field   { margin-bottom: 12px; }
  .dv-lead-field label { display: block; font-size: 10.5px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; }
  .dv-lead-form.rtl .dv-lead-field label { text-transform: none; letter-spacing: 0; font-family: 'Cairo', sans-serif; font-size: 11.5px; text-align: right; }
  .dv-lead-input { width: 100%; padding: 10px 13px; font-size: 13px; font-family: 'Outfit', sans-serif; border: 1.5px solid rgba(0,0,0,0.09); border-radius: 10px; outline: none; color: #1A1A1A; background: #F8F7F5; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; box-sizing: border-box; }
  .dv-lead-form.rtl .dv-lead-input { font-family: 'Cairo', sans-serif; text-align: right; direction: rtl; }
  .dv-lead-input:focus { border-color: rgba(255,107,43,0.45); background: #fff; box-shadow: 0 0 0 3px rgba(255,107,43,0.07); }
  .dv-lead-input::placeholder { color: #C0C0C0; }
  .dv-lead-submit-wrap { padding: 4px 16px 16px; }
  .dv-lead-submit { width: 100%; padding: 12px; border: none; border-radius: 12px; background: linear-gradient(135deg, #FF6B2B, #E84E0F); color: #fff; font-family: 'Outfit', sans-serif; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s; box-shadow: 0 4px 16px rgba(255,107,43,0.4); display: flex; align-items: center; justify-content: center; gap: 8px; }
  .dv-lead-form.rtl .dv-lead-submit { font-family: 'Cairo', sans-serif; }
  .dv-lead-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,107,43,0.5); }
  .dv-lead-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
  .dv-lead-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: dv-spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes dv-spin { to { transform: rotate(360deg); } }
  .dv-lead-error { font-size: 11.5px; color: #c0392b; margin: 0 16px 12px; padding: 8px 12px; background: rgba(192,57,43,0.06); border-radius: 8px; border-left: 3px solid #c0392b; }
  .dv-lead-form.rtl .dv-lead-error { border-left: none; border-right: 3px solid #c0392b; text-align: right; font-family: 'Cairo', sans-serif; }

  @media (max-width: 440px) {
    .dv-panel { width: calc(100vw - 20px); right: 10px; bottom: 88px; height: 75vh; }
    .dv-bubble { bottom: 16px; right: 16px; }
  }
`;

// ── Markdown Renderer ─────────────────────────────────────────────────────────
function renderMarkdown(text, isAr = false) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let i = 0, listItems = [], olItems = [];

  const flushList = (key) => {
    if (listItems.length) { elements.push(<ul key={`ul-${key}`}>{listItems.map((item, j) => <li key={j}>{parseInline(item)}</li>)}</ul>); listItems = []; }
    if (olItems.length)   { elements.push(<ol key={`ol-${key}`}>{olItems.map((item, j) => <li key={j}>{parseInline(item)}</li>)}</ol>);   olItems = [];   }
  };

  const parseInline = (str) => {
    const parts = str.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("***") && part.endsWith("***")) return <strong key={idx}><em>{part.slice(3,-3)}</em></strong>;
      if (part.startsWith("**")  && part.endsWith("**"))  return <strong key={idx}>{part.slice(2,-2)}</strong>;
      if (part.startsWith("*")   && part.endsWith("*") && part.length > 2) return <em key={idx}>{part.slice(1,-1)}</em>;
      if (part.startsWith("`")   && part.endsWith("`"))   return <code key={idx}>{part.slice(1,-1)}</code>;
      return part;
    });
  };

  while (i < lines.length) {
    const t2 = lines[i].trim();
    if (t2 === "---" || t2 === "***") { flushList(i); elements.push(<hr key={i} />); }
    else if (t2.startsWith("### "))   { flushList(i); elements.push(<h3 key={i}>{parseInline(t2.slice(4))}</h3>); }
    else if (t2.startsWith("## "))    { flushList(i); elements.push(<h2 key={i}>{parseInline(t2.slice(3))}</h2>); }
    else if (t2.startsWith("# "))     { flushList(i); elements.push(<h1 key={i}>{parseInline(t2.slice(2))}</h1>); }
    else if (t2.startsWith("> "))     { flushList(i); elements.push(<blockquote key={i}>{parseInline(t2.slice(2))}</blockquote>); }
    else if (/^\d+[.)]\s/.test(t2))   { if (listItems.length) flushList(i); const m = t2.match(/^\d+[.)]\s(.*)/); if (m) olItems.push(m[1]); }
    else if (t2.startsWith("- ") || t2.startsWith("• ") || t2.startsWith("* ")) { if (olItems.length) flushList(i); listItems.push(t2.slice(2)); }
    else if (t2 === "") { flushList(i); }
    else { flushList(i); if (t2) elements.push(<p key={i}>{parseInline(t2)}</p>); }
    i++;
  }
  flushList(i);
  return <div className={`dv-md${isAr ? " ar" : ""}`}>{elements}</div>;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const BubbleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l4.93-1.37A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="#fff" opacity="0.95"/>
    <circle cx="8.5" cy="12" r="1.2" fill="#FF6B2B"/>
    <circle cx="12"  cy="12" r="1.2" fill="#FF6B2B"/>
    <circle cx="15.5" cy="12" r="1.2" fill="#FF6B2B"/>
  </svg>
);
const CloseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>;
const SendIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const EmailIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><polyline points="22,6 12,13 2,6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>;
const PhoneIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>;

const getTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ── Lead Form ─────────────────────────────────────────────────────────────────
function LeadForm({ sessionId, lastUserMessage, onSubmitted, t, isRTL }) {
  const [form,    setForm]    = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError(t.nameRequired); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/chat/lead`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, name: form.name, email: form.email, phone: form.phone, context_message: lastUserMessage }),
      });
      res.ok ? onSubmitted() : setError(t.errorForm);
    } catch { setError(t.errorConnect2); }
    finally   { setLoading(false); }
  };

  return (
    <div className={`dv-lead-form${isRTL ? " rtl" : ""}`}>
      <div className="dv-lead-form-header">
        <div className="dv-lead-form-icon">💬</div>
        <div>
          <div className="dv-lead-form-title">{t.leadFormTitle}</div>
          <div className="dv-lead-form-subtitle">{t.leadFormSubtitle}</div>
        </div>
      </div>
      <div className="dv-lead-fields">
        <div className="dv-lead-field">
          <label>{t.leadName}</label>
          <input className="dv-lead-input" placeholder={t.leadNamePH} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="dv-lead-field">
          <label>{t.leadEmail}</label>
          <input className="dv-lead-input" placeholder={t.leadEmailPH} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="dv-lead-field">
          <label>{t.leadPhone}</label>
          <input className="dv-lead-input" placeholder={t.leadPhonePH} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
      </div>
      {error && <div className="dv-lead-error">{error}</div>}
      <div className="dv-lead-submit-wrap">
        <button className="dv-lead-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? <><span className="dv-lead-spinner" />{t.leadSubmitting}</> : <>{t.leadSubmit} →</>}
        </button>
      </div>
    </div>
  );
}

// ── Contact Card ──────────────────────────────────────────────────────────────
function ContactCard({ email, phone, t, isRTL }) {
  return (
    <div className="dv-contact-card" style={isRTL ? { marginLeft: 0, marginRight: 36, direction: "rtl" } : {}}>
      <div className="dv-contact-card-title">{t.contactCardTitle}</div>
      <div className="dv-contact-item"><div className="dv-contact-icon"><EmailIcon /></div><span className="dv-contact-text">{email}</span></div>
      <div className="dv-contact-item"><div className="dv-contact-icon"><PhoneIcon /></div><span className="dv-contact-text">{phone}</span></div>
    </div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export default function ChatWidget() {
  const [open,      setOpen]      = useState(false);
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [notif,     setNotif]     = useState(true);
  const [welcomed,  setWelcomed]  = useState(false);
  const [lastMsg,   setLastMsg]   = useState("");

  const lang  = getLanguage();
  const t     = T[lang] || T.en;
  const isRTL = lang === "ar";

  const endRef   = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    if (open && !welcomed) { setNotif(false); setWelcomed(true); initChat(); }
    if (open) setTimeout(() => inputRef.current?.focus(), 350);
  }, [open]);

  const initChat = async () => {
    try {
      const res  = await fetch(`${API_BASE}/chat/buttons/${CONTEXT}?language=${lang}`);
      const data = await res.json();
      setMessages([{ id: Date.now(), role: "bot", text: t.welcomeText, buttons: data.buttons || [], time: getTime() }]);
    } catch {
      setMessages([{ id: Date.now(), role: "bot", text: t.welcomeText, time: getTime() }]);
    }
  };

  const handleLeadSubmitted = (formLang) => {
    const tLocal = T[formLang] || t;
    setMessages(prev => [
      ...prev.filter(m => !m.isLeadForm),
      {
        id: Date.now(), role: "bot",
        text: tLocal.leadSuccess,
        buttons: formLang === "ar"
          ? ["كيف يعمل ديفيدو", "استكشف الفرص", "تواصل مع الدعم"]
          : ["How Divido Works", "Explore Opportunities", "Contact Support"],
        msgLang: formLang,
        time: getTime(),
      }
    ]);
  };

  const send = async (text, isBtn = false, btnLabel = null) => {
    if (!text.trim() || loading) return;

    // ── Contact Support → show form directly, no API call ────────────────
    const supportLabels = ["Contact Support", "تواصل مع الدعم", "Need Help", "تحتاج مساعدة؟"];
    if (isBtn && supportLabels.includes(text)) {
      const formLang = (text === "تواصل مع الدعم" || text === "تحتاج مساعدة؟") ? "ar" : "en";
      const uid = Date.now();
      setMessages(prev => [
        ...prev,
        { id: uid,     role: "user", text, time: getTime() },
        { id: uid + 1, role: "bot", isLeadForm: true, formLang, time: getTime() },
      ]);
      return;
    }

    setInput("");
    setLastMsg(text);
    setLoading(true);

    const msgLang   = (!isBtn && detectArabic(text)) ? "ar" : lang;
    // ── BUG FIX: generate both IDs once, before setState ─────────────────
    const userMsgId = Date.now();
    const botMsgId  = userMsgId + 1;

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: "user", text, time: getTime() },
      { id: botMsgId,  role: "bot",  text: "", streaming: true, buttons: [], time: getTime() },
    ]);

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId, clicked_button: isBtn ? btnLabel : null, language: msgLang }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "chunk") {
              setMessages(prev => prev.map(m =>
                m.id === botMsgId ? { ...m, text: m.text + data.text } : m
              ));
            } else if (data.type === "done") {
              if (!sessionId) setSessionId(data.session_id);
              const btns = data.suggested_buttons || [];
              const supportBtn = msgLang === "ar" ? "تواصل مع الدعم" : "Contact Support";
              if (!btns.includes(supportBtn)) btns.push(supportBtn);

              setMessages(prev => [
                ...prev.map(m => m.id === botMsgId ? {
                  ...m, streaming: false, buttons: btns, msgLang,
                  contactInfo: data.contact_info && Object.keys(data.contact_info).length > 0 ? data.contact_info : null,
                } : m),
                ...(data.show_contact_form ? [{
                  id: Date.now() + 2, role: "bot", isLeadForm: true, formLang: msgLang, time: getTime()
                }] : [])
              ]);
            }
          } catch (_) {}
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === botMsgId ? { ...m, streaming: false, text: t.errorConnect } : m
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="dv" style={{ position: "fixed", bottom: 0, right: 0, zIndex: 99997, pointerEvents: "none" }}>
      <style>{CSS}</style>

      {open && (
        <div className="dv-panel" style={{ pointerEvents: "all", direction: isRTL ? "rtl" : "ltr" }}>

          {/* Header */}
          <div className="dv-header">
            <div className="dv-avatar">D</div>
            <div className="dv-header-info">
              <div className="dv-header-name">{t.headerName}</div>
              <div className="dv-header-sub">
                <div className="dv-online-dot" />
                <span className="dv-header-status">{t.headerStatus}</span>
              </div>
            </div>
            <button className="dv-close" onClick={() => setOpen(false)}><CloseIcon /></button>
          </div>

          {/* Messages */}
          <div className="dv-messages">
            <div className="dv-divider">
              <div className="dv-divider-line" />
              <span className="dv-divider-text">{t.startConversation}</span>
              <div className="dv-divider-line" />
            </div>

            {messages.map((msg) => (
              <div key={msg.id} className={`dv-row ${msg.isLeadForm ? "bot" : msg.role}`}>
                {msg.isLeadForm ? (
                  <LeadForm
                    sessionId={sessionId}
                    lastUserMessage={lastMsg}
                    onSubmitted={() => handleLeadSubmitted(msg.formLang || lang)}
                    t={msg.formLang === "ar" ? T.ar : T.en}
                    isRTL={msg.formLang === "ar"}
                  />
                ) : (
                  <>
                    <div className="dv-row-inner">
                      {msg.role === "bot" && <div className="dv-bot-icon">D</div>}
                      <div className="dv-bubble-msg">
                        {msg.role === "bot"
                          ? <>{renderMarkdown(msg.text, msg.msgLang === "ar" || isRTL)}{msg.streaming && <span className="dv-cursor">▋</span>}</>
                          : msg.text
                        }
                      </div>
                    </div>

                    {msg.contactInfo && (
                      <ContactCard email={msg.contactInfo.email} phone={msg.contactInfo.phone}
                        t={msg.msgLang === "ar" ? T.ar : t} isRTL={msg.msgLang === "ar" || isRTL} />
                    )}

                    {!msg.streaming && msg.buttons?.length > 0 && (
                      <div className="dv-btns"
                        style={{ marginLeft: msg.role === "bot" && !isRTL ? "36px" : 0, marginRight: msg.role === "bot" && isRTL ? "36px" : 0 }}>
                        {msg.buttons.map(btn => {
                          const isSupport = btn === "Contact Support" || btn === "تواصل مع الدعم";
                          return (
                            <button key={btn} className={`dv-btn${isSupport ? " support" : ""}`}
                              onClick={() => send(btn, true, btn)} disabled={loading}>
                              {btn}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <span className="dv-time"
                      style={{ marginLeft: msg.role === "bot" && !isRTL ? "36px" : 0, marginRight: msg.role === "bot" && isRTL ? "36px" : 0 }}>
                      {msg.time}
                    </span>
                  </>
                )}
              </div>
            ))}

            {loading && !messages.some(m => m.streaming) && (
              <div className="dv-row bot">
                <div className="dv-row-inner">
                  <div className="dv-bot-icon">D</div>
                  <div className="dv-typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="dv-input-wrap">
            <div className="dv-input-box">
              <textarea ref={inputRef} className="dv-input" placeholder={t.placeholder}
                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                rows={1} disabled={loading}
                style={{ direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left" }}
              />
              <button className="dv-send" onClick={() => send(input)} disabled={!input.trim() || loading}>
                <SendIcon />
              </button>
            </div>
            <div className="dv-footer">{t.footer} <span>{t.footerBrand}</span> {t.footerSub}</div>
          </div>
        </div>
      )}

      <button className={`dv-bubble ${open ? "open" : ""}`} onClick={() => setOpen(p => !p)}
        style={{ pointerEvents: "all" }} aria-label="Open Divido Assistant">
        {notif && !open && <div className="dv-notif" />}
        <BubbleIcon />
      </button>
    </div>
  );
}

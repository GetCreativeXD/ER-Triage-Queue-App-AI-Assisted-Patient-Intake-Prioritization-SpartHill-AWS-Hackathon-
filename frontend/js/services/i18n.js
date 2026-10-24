// =========================================================================
// Lightweight i18n (patient-form translations)
// -------------------------------------------------------------------------
// A string table keyed by language code. The patient chooses a language on the
// welcome screen and from that point the ENTIRE form stays in that language -
// every question prompt, help line, option label, button, validation message,
// and the final success screen. It never reverts to English (a hard
// requirement). English is only used as a fallback for a key a language is
// missing, which should not happen for the keys the form actually uses.
//
// The chosen language is persisted to localStorage so a page refresh keeps it.
// =========================================================================

const STRINGS = {
  // -----------------------------------------------------------------------
  // English
  // -----------------------------------------------------------------------
  en: {
    // Welcome / language screen
    welcomeTitle: "ER Triage Queue",
    welcomeIntro: "Choose your language to begin. A nurse will see your answers to decide who needs help first.",
    languagePrompt: "Choose your language",
    languageSpeakHint: "Or tap the mic and say your language.",
    continue: "Continue",
    welcomeTransition: "Welcome!",

    // Intake chrome
    questionCounter: "Question {current} of {total}",
    back: "Back",
    next: "Next",
    submit: "Submit",
    micHint: "Tap the mic and speak, or type your answer.",
    micListening: "Listening... tap the mic again to stop.",
    micTranscribing: "Transcribing...",
    micReview: "Review the text and edit if needed, or tap the mic to add more.",
    micUnavailable: "Voice is not available in this browser; please type.",
    micStartFailed: "Could not start the microphone. Please type your answer.",
    submitError: "Could not submit. Please try again.",

    // Q1 name
    "q.name.prompt": "What is your name?",
    "q.name.help": "Enter your first and last name.",
    "name.firstLabel": "First name",
    "name.lastLabel": "Last name",
    "name.firstPlaceholder": "e.g. John",
    "name.lastPlaceholder": "e.g. Smith",
    "name.error": "Please enter your first and last name.",

    // Q2 symptoms (formerly "main reason for your visit")
    "q.symptoms.prompt": "What symptoms are you feeling?",
    "q.symptoms.help": "Select all that apply.",
    "symptom.chestPain": "Chest pain",
    "symptom.breathing": "Breathing problem",
    "symptom.injury": "Injury",
    "symptom.abdominal": "Abdominal pain",
    "symptom.fever": "Fever",
    "symptom.headache": "Headache",
    "symptom.other": "Other",
    "symptom.otherPlaceholder": "Please describe your symptoms",
    "symptom.error": "Please select at least one, or describe it under \"Other\".",

    // Q3 severity
    "q.severity.prompt": "How severe is your pain or discomfort right now?",
    "q.severity.help": "1 means minimal discomfort, 10 means extreme pain.",
    "severity.min": "Minimal discomfort",
    "severity.max": "Extreme pain",
    "severity.error": "Please choose a number.",

    // Q4 onset
    "q.onset.prompt": "When did your symptoms start?",
    "onset.lessThanHour": "Less than 1 hour ago",
    "onset.today": "Today",
    "onset.thisWeek": "This week",
    "onset.longer": "Longer",
    "onset.selectOption": "Select Option",
    "onset.longer.2to3weeks": "2-3 weeks ago",
    "onset.longer.1month": "1 month ago",
    "onset.longer.2monthsPlus": "2 months+",
    "onset.otherPlaceholder": "Type when your symptoms started",
    "onset.error": "Please answer to continue.",
    "onset.detailError": "Please choose how long ago.",

    // Q5 trend
    "q.trend.prompt": "Are your symptoms getting better, worse, or staying the same?",
    "trend.worse": "Worse",
    "trend.same": "Same",
    "trend.better": "Better",
    "trend.error": "Please answer to continue.",

    // Q6 description
    "q.description.prompt": "In your own words, what happened?",
    "q.description.help": "You can type or use the microphone.",
    "description.placeholder": "Type here...",
    "description.error": "Please answer to continue.",

    // Success / patient-number screen
    doneTitle: "You're all set",
    doneSubtitle: "Your patient number is",
    doneHelp: "Please keep this number. A nurse will assist you shortly.",
  },

  // -----------------------------------------------------------------------
  // Spanish
  // -----------------------------------------------------------------------
  es: {
    welcomeTitle: "Cola de Triaje de Urgencias",
    welcomeIntro: "Elija su idioma para comenzar. Una enfermera verá sus respuestas para decidir quién necesita ayuda primero.",
    languagePrompt: "Elija su idioma",
    languageSpeakHint: "O toque el micrófono y diga su idioma.",
    continue: "Continuar",
    welcomeTransition: "¡Bienvenido!",

    questionCounter: "Pregunta {current} de {total}",
    back: "Atrás",
    next: "Siguiente",
    submit: "Enviar",
    micHint: "Toque el micrófono y hable, o escriba su respuesta.",
    micListening: "Escuchando... toque el micrófono de nuevo para detener.",
    micTranscribing: "Transcribiendo...",
    micReview: "Revise el texto y edítelo si es necesario, o toque el micrófono para agregar más.",
    micUnavailable: "La voz no está disponible en este navegador; por favor escriba.",
    micStartFailed: "No se pudo iniciar el micrófono. Por favor escriba su respuesta.",
    submitError: "No se pudo enviar. Por favor inténtelo de nuevo.",

    "q.name.prompt": "¿Cómo se llama?",
    "q.name.help": "Ingrese su nombre y apellido.",
    "name.firstLabel": "Nombre",
    "name.lastLabel": "Apellido",
    "name.firstPlaceholder": "ej. Juan",
    "name.lastPlaceholder": "ej. García",
    "name.error": "Por favor ingrese su nombre y apellido.",

    "q.symptoms.prompt": "¿Qué síntomas está sintiendo?",
    "q.symptoms.help": "Seleccione todos los que correspondan.",
    "symptom.chestPain": "Dolor en el pecho",
    "symptom.breathing": "Problema para respirar",
    "symptom.injury": "Lesión",
    "symptom.abdominal": "Dolor abdominal",
    "symptom.fever": "Fiebre",
    "symptom.headache": "Dolor de cabeza",
    "symptom.other": "Otro",
    "symptom.otherPlaceholder": "Describa sus síntomas",
    "symptom.error": "Seleccione al menos uno, o descríbalo en \"Otro\".",

    "q.severity.prompt": "¿Qué tan intenso es su dolor o malestar en este momento?",
    "q.severity.help": "1 significa malestar mínimo, 10 significa dolor extremo.",
    "severity.min": "Malestar mínimo",
    "severity.max": "Dolor extremo",
    "severity.error": "Por favor elija un número.",

    "q.onset.prompt": "¿Cuándo comenzaron sus síntomas?",
    "onset.lessThanHour": "Hace menos de 1 hora",
    "onset.today": "Hoy",
    "onset.thisWeek": "Esta semana",
    "onset.longer": "Más tiempo",
    "onset.selectOption": "Seleccione una opción",
    "onset.longer.2to3weeks": "Hace 2-3 semanas",
    "onset.longer.1month": "Hace 1 mes",
    "onset.longer.2monthsPlus": "2 meses o más",
    "onset.otherPlaceholder": "Escriba cuándo comenzaron sus síntomas",
    "onset.error": "Por favor responda para continuar.",
    "onset.detailError": "Por favor elija hace cuánto tiempo.",

    "q.trend.prompt": "¿Sus síntomas están mejorando, empeorando o igual?",
    "trend.worse": "Peor",
    "trend.same": "Igual",
    "trend.better": "Mejor",
    "trend.error": "Por favor responda para continuar.",

    "q.description.prompt": "En sus propias palabras, ¿qué pasó?",
    "q.description.help": "Puede escribir o usar el micrófono.",
    "description.placeholder": "Escriba aquí...",
    "description.error": "Por favor responda para continuar.",

    doneTitle: "Todo listo",
    doneSubtitle: "Su número de paciente es",
    doneHelp: "Conserve este número. Una enfermera lo atenderá en breve.",
  },

  // -----------------------------------------------------------------------
  // French
  // -----------------------------------------------------------------------
  fr: {
    welcomeTitle: "File de Triage des Urgences",
    welcomeIntro: "Choisissez votre langue pour commencer. Une infirmière verra vos réponses pour décider qui aider en premier.",
    languagePrompt: "Choisissez votre langue",
    languageSpeakHint: "Ou touchez le micro et dites votre langue.",
    continue: "Continuer",
    welcomeTransition: "Bienvenue !",

    questionCounter: "Question {current} sur {total}",
    back: "Retour",
    next: "Suivant",
    submit: "Envoyer",
    micHint: "Touchez le micro et parlez, ou tapez votre réponse.",
    micListening: "Écoute... touchez à nouveau le micro pour arrêter.",
    micTranscribing: "Transcription...",
    micReview: "Vérifiez le texte et modifiez-le si besoin, ou touchez le micro pour en ajouter.",
    micUnavailable: "La voix n'est pas disponible dans ce navigateur ; veuillez taper.",
    micStartFailed: "Impossible de démarrer le micro. Veuillez taper votre réponse.",
    submitError: "L'envoi a échoué. Veuillez réessayer.",

    "q.name.prompt": "Quel est votre nom ?",
    "q.name.help": "Entrez votre prénom et votre nom.",
    "name.firstLabel": "Prénom",
    "name.lastLabel": "Nom",
    "name.firstPlaceholder": "ex. Jean",
    "name.lastPlaceholder": "ex. Dupont",
    "name.error": "Veuillez entrer votre prénom et votre nom.",

    "q.symptoms.prompt": "Quels symptômes ressentez-vous ?",
    "q.symptoms.help": "Sélectionnez tout ce qui s'applique.",
    "symptom.chestPain": "Douleur thoracique",
    "symptom.breathing": "Problème respiratoire",
    "symptom.injury": "Blessure",
    "symptom.abdominal": "Douleur abdominale",
    "symptom.fever": "Fièvre",
    "symptom.headache": "Mal de tête",
    "symptom.other": "Autre",
    "symptom.otherPlaceholder": "Veuillez décrire vos symptômes",
    "symptom.error": "Sélectionnez-en au moins un, ou décrivez-le dans « Autre ».",

    "q.severity.prompt": "Quelle est l'intensité de votre douleur ou gêne en ce moment ?",
    "q.severity.help": "1 signifie gêne minime, 10 signifie douleur extrême.",
    "severity.min": "Gêne minime",
    "severity.max": "Douleur extrême",
    "severity.error": "Veuillez choisir un chiffre.",

    "q.onset.prompt": "Quand vos symptômes ont-ils commencé ?",
    "onset.lessThanHour": "Il y a moins d'une heure",
    "onset.today": "Aujourd'hui",
    "onset.thisWeek": "Cette semaine",
    "onset.longer": "Plus longtemps",
    "onset.selectOption": "Sélectionner une option",
    "onset.longer.2to3weeks": "Il y a 2-3 semaines",
    "onset.longer.1month": "Il y a 1 mois",
    "onset.longer.2monthsPlus": "2 mois et plus",
    "onset.otherPlaceholder": "Tapez quand vos symptômes ont commencé",
    "onset.error": "Veuillez répondre pour continuer.",
    "onset.detailError": "Veuillez choisir depuis combien de temps.",

    "q.trend.prompt": "Vos symptômes s'améliorent-ils, s'aggravent-ils ou restent-ils stables ?",
    "trend.worse": "Pire",
    "trend.same": "Pareil",
    "trend.better": "Mieux",
    "trend.error": "Veuillez répondre pour continuer.",

    "q.description.prompt": "Dans vos propres mots, que s'est-il passé ?",
    "q.description.help": "Vous pouvez taper ou utiliser le micro.",
    "description.placeholder": "Tapez ici...",
    "description.error": "Veuillez répondre pour continuer.",

    doneTitle: "Tout est prêt",
    doneSubtitle: "Votre numéro de patient est",
    doneHelp: "Veuillez conserver ce numéro. Une infirmière vous assistera sous peu.",
  },

  // -----------------------------------------------------------------------
  // Chinese (Simplified)
  // -----------------------------------------------------------------------
  zh: {
    welcomeTitle: "急诊分诊队列",
    welcomeIntro: "请选择您的语言开始。护士将查看您的回答以决定优先顺序。",
    languagePrompt: "选择您的语言",
    languageSpeakHint: "或点击麦克风说出您的语言。",
    continue: "继续",
    welcomeTransition: "欢迎！",

    questionCounter: "第 {current} 题，共 {total} 题",
    back: "返回",
    next: "下一步",
    submit: "提交",
    micHint: "点击麦克风说话，或输入您的答案。",
    micListening: "正在聆听……再次点击麦克风以停止。",
    micTranscribing: "转录中……",
    micReview: "请检查文字，如有需要可修改，或点击麦克风继续添加。",
    micUnavailable: "此浏览器不支持语音；请输入文字。",
    micStartFailed: "无法启动麦克风。请输入您的答案。",
    submitError: "提交失败。请重试。",

    "q.name.prompt": "您叫什么名字？",
    "q.name.help": "请输入您的名字和姓氏。",
    "name.firstLabel": "名字",
    "name.lastLabel": "姓氏",
    "name.firstPlaceholder": "例如：伟",
    "name.lastPlaceholder": "例如：王",
    "name.error": "请输入您的名字和姓氏。",

    "q.symptoms.prompt": "您感觉有哪些症状？",
    "q.symptoms.help": "请选择所有适用项。",
    "symptom.chestPain": "胸痛",
    "symptom.breathing": "呼吸困难",
    "symptom.injury": "受伤",
    "symptom.abdominal": "腹痛",
    "symptom.fever": "发烧",
    "symptom.headache": "头痛",
    "symptom.other": "其他",
    "symptom.otherPlaceholder": "请描述您的症状",
    "symptom.error": "请至少选择一项，或在“其他”中描述。",

    "q.severity.prompt": "您现在的疼痛或不适有多严重？",
    "q.severity.help": "1 表示轻微不适，10 表示极度疼痛。",
    "severity.min": "轻微不适",
    "severity.max": "极度疼痛",
    "severity.error": "请选择一个数字。",

    "q.onset.prompt": "您的症状是什么时候开始的？",
    "onset.lessThanHour": "不到1小时前",
    "onset.today": "今天",
    "onset.thisWeek": "本周",
    "onset.longer": "更久",
    "onset.selectOption": "选择选项",
    "onset.longer.2to3weeks": "2-3周前",
    "onset.longer.1month": "1个月前",
    "onset.longer.2monthsPlus": "2个月以上",
    "onset.otherPlaceholder": "请输入症状开始的时间",
    "onset.error": "请回答以继续。",
    "onset.detailError": "请选择多久以前。",

    "q.trend.prompt": "您的症状是在好转、恶化，还是保持不变？",
    "trend.worse": "恶化",
    "trend.same": "不变",
    "trend.better": "好转",
    "trend.error": "请回答以继续。",

    "q.description.prompt": "用您自己的话说，发生了什么？",
    "q.description.help": "您可以输入文字或使用麦克风。",
    "description.placeholder": "在此输入……",
    "description.error": "请回答以继续。",

    doneTitle: "全部完成",
    doneSubtitle: "您的患者编号是",
    doneHelp: "请保留此编号。护士将很快为您服务。",
  },
};

const STORAGE_KEY = "er-triage-language";

/** Current UI language; restored from storage, defaults to English. */
let current = "en";
try {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STRINGS[saved]) current = saved;
  }
} catch { /* ignore */ }

export function setLanguage(code) {
  if (STRINGS[code]) {
    current = code;
    try { if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }
}
export function getLanguage() { return current; }

/**
 * Translate a key for the current language, falling back to English.
 * Supports simple {placeholder} interpolation via the second argument, e.g.
 *   t("questionCounter", { current: 2, total: 6 })
 */
export function t(key, vars) {
  let str = (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp("\\{" + k + "\\}", "g"), String(v));
    }
  }
  return str;
}

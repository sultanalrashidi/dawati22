import type { Locale } from "@/lib/i18n/locales";

/**
 * The site's legal pages — terms, privacy, and refunds — live here rather than
 * in the i18n JSON dictionaries on purpose. Those dictionaries hold short UI
 * strings; a legal document is long-form prose with headings, ordered clauses
 * and bullet lists, and it reads and edits far better as structured, typed
 * content than as hundreds of flat JSON keys. Both languages sit side by side
 * so a wording change is made once, in one file, for the pair.
 *
 * These pages exist because a payment provider (Moyasar) requires a merchant to
 * publish clear terms, a privacy policy and a refund/cancellation policy before
 * it activates real payments. They describe the service as it actually works —
 * a paid, digital, delivered-on-demand product — so the refund terms in
 * particular match how invitations are fulfilled.
 *
 * The store name shown to customers stays دعوتي / Dawati; contact details come
 * from `@/lib/support` so there is one place to change a number or address.
 */

/**
 * A "contact us" line rendered with clickable WhatsApp and email links rather
 * than a spelled-out number and address — the number/address never appear as
 * text; the reader taps the channel name to open WhatsApp or their mail app.
 * `lead` is the sentence up to the channels; `trailing` (if any) continues the
 * sentence after them, otherwise the renderer ends it with a full stop.
 */
export interface LegalContact {
  lead: string;
  trailing?: string;
}

export interface LegalSection {
  heading: string;
  /** Paragraphs of body text, rendered in order. */
  body?: string[];
  /** Optional bullet list rendered under the paragraphs. */
  bullets?: string[];
  /** A contact line with live WhatsApp/email links — see LegalContact. */
  contact?: LegalContact;
}

export interface LegalDoc {
  title: string;
  /** Localised "last updated" date, shown under the title. */
  updated: string;
  /** Lead paragraph(s) before the first section. */
  intro: string[];
  sections: LegalSection[];
}

export type LegalDocId = "terms" | "privacy" | "refunds";

/**
 * The date these documents were last reviewed. Hardcoded on purpose — a legal
 * page shows when its wording was fixed, not today's date. Bump it by hand when
 * the wording changes.
 */
const UPDATED = { ar: "٣١ أغسطس ٢٠٢٦", en: "August 31, 2026" };

const ar: Record<LegalDocId, LegalDoc> = {
  terms: {
    title: "الشروط والأحكام",
    updated: UPDATED.ar,
    intro: [
      "مرحبًا بك في «دعوتي». تحدّد هذه الشروط والأحكام قواعد استخدامك لمنصة دعوتي المتاحة عبر الموقع www.dawati.store وما يرتبط بها من خدمات لإنشاء الدعوات الرقمية وإدارتها. باستخدامك للمنصة أو إتمامك لأي عملية دفع فإنك تُقرّ بأنك قرأت هذه الشروط ووافقت عليها.",
      "تُقدَّم خدمات دعوتي داخل المملكة العربية السعودية، وجميع الأسعار بالريال السعودي (SAR).",
    ],
    sections: [
      {
        heading: "١. تعريف الخدمة",
        body: [
          "دعوتي منصّة رقمية تتيح لك إنشاء دعوات إلكترونية للمناسبات (مثل الأعراس والحفلات)، وإرسالها إلى الضيوف، واستقبال ردود الحضور (RSVP)، وإصدار بطاقات دخول وإدارة الدخول عبر رمز QR عند بعض الباقات.",
          "الخدمة رقمية بالكامل؛ لا نشحن أي منتجات مادية، ويتم تسليم ما تشتريه إلكترونيًا داخل حسابك.",
        ],
      },
      {
        heading: "٢. الحساب والتسجيل",
        body: [
          "يتطلب استخدام بعض الميزات إنشاء حساب باستخدام رقم جوالك والتحقق منه عبر رمز يُرسل إليك. أنت مسؤول عن صحة البيانات التي تُدخلها وعن الحفاظ على سرية وصولك إلى حسابك وعن جميع الأنشطة التي تتم من خلاله.",
          "يجب ألا يقل عمرك عن ١٨ عامًا أو أن تستخدم المنصة تحت إشراف ولي أمر أو من له الصلاحية النظامية.",
        ],
      },
      {
        heading: "٣. الأسعار والدفع",
        body: [
          "تُحتسب الأسعار حسب عدد الدعوات والخيارات المختارة، وتظهر لك التكلفة النهائية بوضوح قبل الدفع في صفحة الباقات وصفحة الدفع. الأسعار المعروضة وقت إتمام الطلب هي الأسعار المعتمدة.",
          "تتم عملية الدفع عبر بوابة الدفع «ميسر» (Moyasar) وتشمل وسائل مدى وVisa وMastercard وApple Pay. لا نقوم بتخزين بيانات بطاقتك؛ تُعالَج بيانات الدفع مباشرةً لدى مزوّد الدفع وفق معاييره الأمنية.",
        ],
      },
      {
        heading: "٤. تسليم الخدمة الرقمية",
        body: [
          "بعد إتمام الدفع بنجاح، تتوفر الخدمة المشتراة في حسابك مباشرةً، ويمكنك تجهيز الدعوة ومشاركتها مع ضيوفك. يُعدّ بدء إنشاء الدعوات أو إرسالها بدءًا فعليًا لتنفيذ الخدمة.",
        ],
      },
      {
        heading: "٥. الاستخدام المقبول والمحتوى",
        body: [
          "أنت وحدك المسؤول عن المحتوى الذي تُدخله (أسماء المناسبة والضيوف وتفاصيلها). وتتعهّد بعدم استخدام المنصة في أي غرض مخالف للأنظمة السعودية أو للآداب العامة، وبعدم رفع محتوى ينتهك حقوق الغير.",
        ],
        bullets: [
          "عدم إرسال رسائل مزعجة أو انتحال صفة الغير.",
          "عدم محاولة اختراق المنصة أو تعطيلها أو الوصول غير المصرّح به إليها.",
          "الحصول على موافقة ضيوفك قبل إدخال بياناتهم واستخدامها لأغراض الدعوة فقط.",
        ],
      },
      {
        heading: "٦. الملكية الفكرية",
        body: [
          "التصاميم والقوالب والعلامة التجارية «دعوتي» وجميع عناصر المنصة مملوكة لنا أو مرخّصة لنا، ولا يجوز نسخها أو إعادة بيعها دون إذن. أمّا بيانات مناسبتك التي تُدخلها فتبقى ملكًا لك، وتمنحنا ترخيصًا محدودًا باستخدامها لتشغيل الخدمة لك.",
        ],
      },
      {
        heading: "٧. الإلغاء والاسترجاع",
        body: [
          "يخضع الإلغاء واسترجاع المبالغ لسياسة الاسترجاع والإلغاء الخاصة بنا، وهي جزء لا يتجزأ من هذه الشروط. يُرجى مراجعتها لمعرفة الحالات التي يجوز فيها الاسترجاع.",
        ],
      },
      {
        heading: "٨. حدود المسؤولية",
        body: [
          "نبذل جهدًا معقولًا لإتاحة الخدمة بشكل مستقر، لكننا لا نضمن خلوّها من الانقطاعات أو الأخطاء. لا نتحمّل المسؤولية عن الأضرار غير المباشرة، ولا عن أخطاء في البيانات التي أدخلتها بنفسك، ولا عمّا يخرج عن سيطرتنا المعقولة. لا يحدّ ذلك من أي حقوق يكفلها لك النظام.",
        ],
      },
      {
        heading: "٩. الخصوصية",
        body: [
          "تُوضّح سياسة الخصوصية كيف نجمع بياناتك الشخصية ونستخدمها ونحميها، وهي مكمّلة لهذه الشروط.",
        ],
      },
      {
        heading: "١٠. تعديل الشروط",
        body: [
          "قد نُحدّث هذه الشروط من وقت لآخر، ويسري التحديث فور نشره على هذه الصفحة مع تحديث تاريخ آخر مراجعة. استمرارك في استخدام المنصة بعد التحديث يُعدّ موافقةً عليه.",
        ],
      },
      {
        heading: "١١. النظام الواجب التطبيق",
        body: [
          "تخضع هذه الشروط وتُفسَّر وفق أنظمة المملكة العربية السعودية، وتختص الجهات القضائية المختصة في المملكة بالنظر في أي نزاع ينشأ عنها.",
        ],
      },
      {
        heading: "١٢. التواصل معنا",
        contact: { lead: "لأي استفسار حول هذه الشروط يمكنك التواصل معنا" },
      },
    ],
  },
  privacy: {
    title: "سياسة الخصوصية",
    updated: UPDATED.ar,
    intro: [
      "خصوصيتك تهمّنا. تشرح هذه السياسة كيف تجمع «دعوتي» بياناتك الشخصية عند استخدامك للموقع www.dawati.store، وكيف نستخدمها ونحميها ومع من قد نشاركها، وذلك بما يتوافق مع نظام حماية البيانات الشخصية في المملكة العربية السعودية.",
    ],
    sections: [
      {
        heading: "١. البيانات التي نجمعها",
        bullets: [
          "بيانات الحساب: رقم الجوال والاسم عند التسجيل.",
          "بيانات المناسبة: تفاصيل المناسبة وقائمة الضيوف التي تُدخلها أنت (أسماء وأرقام تواصل).",
          "بيانات الدفع: نستقبل من مزوّد الدفع تأكيد العملية وآخر أرقام البطاقة ونوعها فقط؛ لا نُخزّن رقم بطاقتك الكامل.",
          "بيانات تقنية: عنوان IP ونوع المتصفّح والجهاز وسجلات الاستخدام بغرض التشغيل والأمان.",
        ],
      },
      {
        heading: "٢. كيف نستخدم البيانات",
        bullets: [
          "لتقديم الخدمة: إنشاء الدعوات وإرسالها وإدارة ردود الحضور والدخول.",
          "لمعالجة المدفوعات وإصدار تأكيدات الطلبات.",
          "لتحسين المنصة وحمايتها من إساءة الاستخدام.",
          "للتواصل معك بشأن طلبك أو الدعم الفني.",
        ],
      },
      {
        heading: "٣. مشاركة البيانات",
        body: [
          "لا نبيع بياناتك الشخصية. وقد نشاركها فقط في الحدود اللازمة مع:",
        ],
        bullets: [
          "مزوّد الدفع «ميسر» (Moyasar) لإتمام عمليات الدفع بأمان.",
          "مزوّدي الاستضافة والبنية التقنية الذين نشغّل عليهم الخدمة.",
          "الجهات المختصة عند وجود التزام نظامي يقتضي ذلك.",
        ],
      },
      {
        heading: "٤. ملفات تعريف الارتباط (Cookies)",
        body: [
          "نستخدم ملفات وتقنيات أساسية لتشغيل الموقع وحفظ جلستك وتفضيلاتك (مثل اللغة والمظهر). يمكنك التحكم في ملفات الارتباط من إعدادات متصفّحك، مع العلم أن تعطيل بعضها قد يؤثّر على عمل الموقع.",
        ],
      },
      {
        heading: "٥. الاحتفاظ بالبيانات",
        body: [
          "نحتفظ ببياناتك طوال المدة اللازمة لتقديم الخدمة والوفاء بالالتزامات النظامية والمحاسبية، ثم نحذفها أو نجعلها مجهولة المصدر عند انتفاء الحاجة إليها.",
        ],
      },
      {
        heading: "٦. حماية البيانات",
        body: [
          "نطبّق إجراءات تقنية وتنظيمية معقولة لحماية بياناتك، منها التشفير أثناء النقل والوصول المحدود. ومع ذلك لا يمكن ضمان أمان أي وسيلة نقل عبر الإنترنت بنسبة ١٠٠٪.",
        ],
      },
      {
        heading: "٧. حقوقك",
        body: [
          "وفقًا لنظام حماية البيانات الشخصية، يحق لك الوصول إلى بياناتك وطلب تصحيحها أو حذفها وسحب موافقتك، ضمن الحدود النظامية. لممارسة هذه الحقوق تواصل معنا عبر الوسائل الموضّحة أدناه.",
        ],
      },
      {
        heading: "٨. بيانات ضيوفك",
        body: [
          "عند إدخالك بيانات ضيوفك تكون أنت المسؤول عن الحصول على موافقتهم، وتلتزم باستخدامها لغرض الدعوة فقط. نعالج هذه البيانات نيابةً عنك لتشغيل الخدمة.",
        ],
      },
      {
        heading: "٩. تعديل السياسة",
        body: [
          "قد نُحدّث هذه السياسة، وننشر أي تحديث على هذه الصفحة مع تحديث تاريخ آخر مراجعة.",
        ],
      },
      {
        heading: "١٠. التواصل معنا",
        contact: { lead: "لأي استفسار أو طلب يتعلق بخصوصيتك، تواصل معنا" },
      },
    ],
  },
  refunds: {
    title: "سياسة الاسترجاع والإلغاء",
    updated: UPDATED.ar,
    intro: [
      "نوضّح في هذه السياسة متى يمكن إلغاء طلبك واسترجاع المبلغ المدفوع. ولأن دعوتي خدمة رقمية تُنشأ عند الطلب، فإن إمكانية الاسترجاع مرتبطة بمرحلة تنفيذ الخدمة.",
    ],
    sections: [
      {
        heading: "١. طبيعة الخدمة",
        body: [
          "الدعوات منتج رقمي يُجهَّز خصيصًا لمناسبتك بمجرد الدفع. لا يوجد شحن أو منتج مادي، ويبدأ التنفيذ عند شروعك في إنشاء الدعوات أو إرسالها إلى ضيوفك.",
        ],
      },
      {
        heading: "٢. الاسترجاع قبل بدء التنفيذ",
        body: [
          "يمكنك طلب إلغاء طلبك واسترجاع كامل المبلغ ما لم يبدأ تنفيذ الخدمة — أي قبل إنشاء دعواتك أو إرسال أي منها إلى الضيوف. يكفي أن تتواصل معنا وتزوّدنا برقم الطلب.",
        ],
      },
      {
        heading: "٣. بعد بدء التنفيذ",
        body: [
          "بعد بدء إنشاء الدعوات أو إرسالها، يكون قد تم تقديم الخدمة الرقمية ولا يمكن استرجاع المبلغ، باستثناء الحالات الموضّحة في البند التالي.",
        ],
      },
      {
        heading: "٤. حالات نعيد فيها المبلغ دائمًا",
        bullets: [
          "الخصم المكرر لنفس الطلب عن طريق الخطأ.",
          "خصم مبلغ دون أن تُقدَّم لك الخدمة بسبب خلل تقني من طرفنا.",
          "أي خطأ في مبلغ الخصم يعود إلى المنصة.",
        ],
      },
      {
        heading: "٥. كيفية طلب الاسترجاع",
        contact: {
          lead: "تواصل معنا",
          trailing:
            "، مع ذكر رقم الطلب وسبب الطلب. سنردّ عليك ونوضّح ما إذا كان طلبك مستوفيًا لشروط الاسترجاع.",
        },
      },
      {
        heading: "٦. مدة معالجة الاسترجاع",
        body: [
          "عند الموافقة على الاسترجاع، تتم إعادة المبلغ إلى الوسيلة نفسها التي دفعت بها عبر بوابة «ميسر». وقد يستغرق ظهور المبلغ في حسابك حتى ١٤ يوم عمل حسب إجراءات البنك المُصدِر للبطاقة.",
        ],
      },
      {
        heading: "٧. التواصل معنا",
        contact: { lead: "لأي استفسار حول الإلغاء أو الاسترجاع، تواصل معنا" },
      },
    ],
  },
};

const en: Record<LegalDocId, LegalDoc> = {
  terms: {
    title: "Terms & Conditions",
    updated: UPDATED.en,
    intro: [
      "Welcome to Dawati. These Terms & Conditions govern your use of the Dawati platform at www.dawati.store and its related services for creating and managing digital invitations. By using the platform or completing any payment, you confirm that you have read and agreed to these terms.",
      "Dawati's services are offered within the Kingdom of Saudi Arabia, and all prices are in Saudi Riyals (SAR).",
    ],
    sections: [
      {
        heading: "1. The service",
        body: [
          "Dawati is a digital platform that lets you create electronic invitations for events (such as weddings and parties), send them to guests, collect RSVPs, and — on some plans — issue entry passes and manage entry via a QR code.",
          "The service is fully digital; we ship no physical goods, and everything you purchase is delivered electronically within your account.",
        ],
      },
      {
        heading: "2. Accounts and registration",
        body: [
          "Some features require an account created with your mobile number and verified via a one-time code sent to you. You are responsible for the accuracy of the data you enter, for keeping your account access confidential, and for all activity that takes place through it.",
          "You must be at least 18 years old, or use the platform under the supervision of a guardian or a person with legal authority.",
        ],
      },
      {
        heading: "3. Pricing and payment",
        body: [
          "Prices are calculated based on the number of invitations and the options you choose, and the final cost is shown clearly before payment on the plans and checkout pages. The prices displayed at the time you place your order are the ones that apply.",
          "Payment is processed through the Moyasar payment gateway and supports mada, Visa, Mastercard and Apple Pay. We do not store your card details; payment data is processed directly by the payment provider under its security standards.",
        ],
      },
      {
        heading: "4. Digital delivery",
        body: [
          "Once payment succeeds, the purchased service becomes available in your account immediately, and you can prepare and share your invitation with your guests. Beginning to create or send invitations is considered the actual start of performing the service.",
        ],
      },
      {
        heading: "5. Acceptable use and content",
        body: [
          "You are solely responsible for the content you enter (event and guest names and details). You agree not to use the platform for any purpose that violates Saudi laws or public morals, and not to upload content that infringes the rights of others.",
        ],
        bullets: [
          "No spam and no impersonation of others.",
          "No attempt to hack, disrupt, or gain unauthorised access to the platform.",
          "Obtain your guests' consent before entering their data, and use it only for the invitation.",
        ],
      },
      {
        heading: "6. Intellectual property",
        body: [
          "The designs, templates, the Dawati brand and all platform elements are owned by or licensed to us and may not be copied or resold without permission. The event data you enter remains yours, and you grant us a limited licence to use it to operate the service for you.",
        ],
      },
      {
        heading: "7. Cancellation and refunds",
        body: [
          "Cancellations and refunds are governed by our Refund & Cancellation Policy, which forms part of these terms. Please review it to learn when a refund is available.",
        ],
      },
      {
        heading: "8. Limitation of liability",
        body: [
          "We make reasonable efforts to keep the service stable, but we do not guarantee it will be free of interruptions or errors. We are not liable for indirect damages, for errors in data you entered yourself, or for matters beyond our reasonable control. This does not limit any rights granted to you by law.",
        ],
      },
      {
        heading: "9. Privacy",
        body: [
          "Our Privacy Policy explains how we collect, use and protect your personal data, and it complements these terms.",
        ],
      },
      {
        heading: "10. Changes to these terms",
        body: [
          "We may update these terms from time to time. An update takes effect once published on this page, with the last-reviewed date updated. Continuing to use the platform after an update constitutes acceptance of it.",
        ],
      },
      {
        heading: "11. Governing law",
        body: [
          "These terms are governed by and construed in accordance with the laws of the Kingdom of Saudi Arabia, and the competent courts in the Kingdom have jurisdiction over any dispute arising from them.",
        ],
      },
      {
        heading: "12. Contact us",
        contact: { lead: "For any question about these terms, you can reach us" },
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: UPDATED.en,
    intro: [
      "Your privacy matters to us. This policy explains how Dawati collects your personal data when you use www.dawati.store, and how we use, protect and share it, in line with the Personal Data Protection Law of the Kingdom of Saudi Arabia.",
    ],
    sections: [
      {
        heading: "1. Data we collect",
        bullets: [
          "Account data: your mobile number and name at sign-up.",
          "Event data: the event details and guest list you enter (names and contact numbers).",
          "Payment data: from the payment provider we receive only the transaction confirmation and the card's last digits and type; we do not store your full card number.",
          "Technical data: IP address, browser and device type, and usage logs for operation and security.",
        ],
      },
      {
        heading: "2. How we use data",
        bullets: [
          "To provide the service: creating and sending invitations and managing RSVPs and entry.",
          "To process payments and issue order confirmations.",
          "To improve and protect the platform from misuse.",
          "To contact you about your order or for support.",
        ],
      },
      {
        heading: "3. Sharing data",
        body: [
          "We do not sell your personal data. We share it only as necessary with:",
        ],
        bullets: [
          "The Moyasar payment provider, to complete payments securely.",
          "Hosting and infrastructure providers we run the service on.",
          "Competent authorities where a legal obligation requires it.",
        ],
      },
      {
        heading: "4. Cookies",
        body: [
          "We use essential files and technologies to run the site and keep your session and preferences (such as language and theme). You can control cookies from your browser settings, noting that disabling some may affect how the site works.",
        ],
      },
      {
        heading: "5. Data retention",
        body: [
          "We keep your data for as long as needed to provide the service and meet legal and accounting obligations, then delete it or make it anonymous when it is no longer needed.",
        ],
      },
      {
        heading: "6. Data security",
        body: [
          "We apply reasonable technical and organisational measures to protect your data, including encryption in transit and limited access. However, no method of transmission over the internet can be guaranteed 100% secure.",
        ],
      },
      {
        heading: "7. Your rights",
        body: [
          "Under the Personal Data Protection Law, you have the right to access your data and to request its correction or deletion and to withdraw your consent, within the legal limits. To exercise these rights, contact us using the details below.",
        ],
      },
      {
        heading: "8. Your guests' data",
        body: [
          "When you enter your guests' data, you are responsible for obtaining their consent and undertake to use it only for the invitation. We process this data on your behalf to operate the service.",
        ],
      },
      {
        heading: "9. Changes to this policy",
        body: [
          "We may update this policy and will publish any update on this page with the last-reviewed date updated.",
        ],
      },
      {
        heading: "10. Contact us",
        contact: { lead: "For any privacy question or request, you can reach us" },
      },
    ],
  },
  refunds: {
    title: "Refund & Cancellation Policy",
    updated: UPDATED.en,
    intro: [
      "This policy explains when you can cancel your order and get a refund. Because Dawati is a digital service created on demand, the ability to refund depends on the stage of performing the service.",
    ],
    sections: [
      {
        heading: "1. Nature of the service",
        body: [
          "Invitations are a digital product prepared specifically for your event as soon as you pay. There is no shipping and no physical product, and performance begins when you start creating or sending your invitations to your guests.",
        ],
      },
      {
        heading: "2. Refund before performance begins",
        body: [
          "You may request to cancel your order and receive a full refund as long as performance has not begun — that is, before your invitations are created or any of them are sent to guests. Simply contact us and provide your order number.",
        ],
      },
      {
        heading: "3. After performance begins",
        body: [
          "Once creating or sending invitations has begun, the digital service has been provided and the amount is non-refundable, except for the cases set out in the next section.",
        ],
      },
      {
        heading: "4. Cases we always refund",
        bullets: [
          "A duplicate charge for the same order made in error.",
          "A charge where the service was not provided to you due to a technical fault on our side.",
          "Any error in the charged amount attributable to the platform.",
        ],
      },
      {
        heading: "5. How to request a refund",
        contact: {
          lead: "Reach us",
          trailing:
            ", quoting your order number and the reason. We will respond and let you know whether your request meets the refund conditions.",
        },
      },
      {
        heading: "6. Refund processing time",
        body: [
          "When a refund is approved, the amount is returned to the same method you paid with, through the Moyasar gateway. It may take up to 14 business days to appear in your account, depending on your card issuer's procedures.",
        ],
      },
      {
        heading: "7. Contact us",
        contact: { lead: "For any question about cancellation or refunds, you can reach us" },
      },
    ],
  },
};

const documents: Record<Locale, Record<LegalDocId, LegalDoc>> = { ar, en };

export function getLegalDoc(locale: Locale, id: LegalDocId): LegalDoc {
  return documents[locale][id];
}

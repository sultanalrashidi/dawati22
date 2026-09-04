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
const UPDATED = { ar: "٤ سبتمبر ٢٠٢٦", en: "September 4, 2026" };

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
        heading: "٢. التصميم قبل الدفع",
        body: [
          "تصميم الدعوة ومعاينتها مجانًا، ولا يتطلبان حسابًا ولا دفعًا. وما تصمّمه قبل الدفع نسخة تجريبية تحمل علامة مائية، وليست دعوة صالحة للإرسال: لا يُنشأ لها رابط لأي مدعو، ولا رمز دخول، ولا تعمل عليها ردود الحضور.",
          "وتقدر قبل الدفع تشارك رابط المعاينة مع عدد محدود من الأشخاص (ثلاثة أجهزة). هذا الحدّ للتنظيم فقط، ولا يمنع من رأى المعاينة من تصويرها أو نسخ ما فيها.",
          "الدعوة المصمّمة بدون تسجيل دخول محفوظة في متصفّحك عبر ملف ارتباط، وتُحذف نهائيًا بعد ٣٠ يومًا من آخر تعديل عليها إن لم تُربط بحساب ولم تُفعَّل. سجّل الدخول لتبقى دعوتك محفوظة في حسابك.",
          "وبالدفع تُفعَّل الدعوة: تُرفع العلامة المائية، ويصير بإمكانك إضافة المدعوين وإنشاء روابط دعواتهم — وهذي هي الخدمة التي تدفع مقابلها.",
        ],
      },
      {
        heading: "٣. الحساب والتسجيل",
        body: [
          "يتطلب استخدام بعض الميزات إنشاء حساب باستخدام رقم جوالك والتحقق منه عبر رمز يُرسل إليك. أنت مسؤول عن صحة البيانات التي تُدخلها وعن الحفاظ على سرية وصولك إلى حسابك وعن جميع الأنشطة التي تتم من خلاله.",
          "يجب ألا يقل عمرك عن ١٨ عامًا أو أن تستخدم المنصة تحت إشراف ولي أمر أو من له الصلاحية النظامية.",
        ],
      },
      {
        heading: "٤. الأسعار والدفع",
        body: [
          "تُحتسب الأسعار حسب عدد الدعوات والخيارات المختارة، وتظهر لك التكلفة النهائية بوضوح قبل الدفع في صفحة الباقات وصفحة الدفع. الأسعار المعروضة وقت إتمام الطلب هي الأسعار المعتمدة.",
          "تتم عملية الدفع عبر بوابة الدفع «ميسر» (Moyasar) وتشمل وسائل مدى وVisa وMastercard وApple Pay. لا نقوم بتخزين بيانات بطاقتك؛ تُعالَج بيانات الدفع مباشرةً لدى مزوّد الدفع وفق معاييره الأمنية.",
        ],
      },
      {
        heading: "٥. تسليم الخدمة الرقمية",
        body: [
          "بعد إتمام الدفع بنجاح، تتوفر الخدمة المشتراة في حسابك مباشرةً، ويمكنك تجهيز الدعوة ومشاركتها مع ضيوفك. ويُعدّ إنشاء روابط الدعوات للمدعوين بعد التفعيل بدءًا فعليًا لتنفيذ الخدمة.",
        ],
      },
      {
        heading: "٦. الاستخدام المقبول والمحتوى",
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
        heading: "٧. الملكية الفكرية",
        body: [
          "التصاميم والقوالب والعلامة التجارية «دعوتي» وجميع عناصر المنصة مملوكة لنا أو مرخّصة لنا، ولا يجوز نسخها أو إعادة بيعها دون إذن. أمّا بيانات مناسبتك التي تُدخلها فتبقى ملكًا لك، وتمنحنا ترخيصًا محدودًا باستخدامها لتشغيل الخدمة لك.",
        ],
      },
      {
        heading: "٨. الإلغاء والاسترجاع",
        body: [
          "يخضع الإلغاء واسترجاع المبالغ لسياسة الاسترجاع والإلغاء الخاصة بنا، وهي جزء لا يتجزأ من هذه الشروط. يُرجى مراجعتها لمعرفة الحالات التي يجوز فيها الاسترجاع.",
        ],
      },
      {
        heading: "٩. حدود المسؤولية",
        body: [
          "نبذل جهدًا معقولًا لإتاحة الخدمة بشكل مستقر، لكننا لا نضمن خلوّها من الانقطاعات أو الأخطاء. لا نتحمّل المسؤولية عن الأضرار غير المباشرة، ولا عن أخطاء في البيانات التي أدخلتها بنفسك، ولا عمّا يخرج عن سيطرتنا المعقولة. لا يحدّ ذلك من أي حقوق يكفلها لك النظام.",
        ],
      },
      {
        heading: "١٠. الخصوصية",
        body: [
          "تُوضّح سياسة الخصوصية كيف نجمع بياناتك الشخصية ونستخدمها ونحميها، وهي مكمّلة لهذه الشروط.",
        ],
      },
      {
        heading: "١١. تعديل الشروط",
        body: [
          "قد نُحدّث هذه الشروط من وقت لآخر، ويسري التحديث فور نشره على هذه الصفحة مع تحديث تاريخ آخر مراجعة. استمرارك في استخدام المنصة بعد التحديث يُعدّ موافقةً عليه.",
        ],
      },
      {
        heading: "١٢. النظام الواجب التطبيق",
        body: [
          "تخضع هذه الشروط وتُفسَّر وفق أنظمة المملكة العربية السعودية، وتختص الجهات القضائية المختصة في المملكة بالنظر في أي نزاع ينشأ عنها.",
        ],
      },
      {
        heading: "١٣. التواصل معنا",
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
          "بيانات الدعوة قبل التسجيل: كل ما تُدخله في الدعوة التي تصمّمها قبل إنشاء حساب وقبل الدفع — تفصيلها في البند التالي.",
          "بيانات الدفع: نستقبل من مزوّد الدفع تأكيد العملية وآخر أرقام البطاقة ونوعها فقط؛ لا نُخزّن رقم بطاقتك الكامل.",
          "بيانات تقنية: عنوان IP ونوع المتصفّح والجهاز وسجلات الاستخدام بغرض التشغيل والأمان. وعند بدء دعوة جديدة بدون تسجيل دخول نحفظ بصمة مشفّرة (hash) لعنوان الشبكة بدلًا من العنوان نفسه، للحدّ من إساءة الاستخدام.",
        ],
      },
      {
        heading: "٢. الدعوة التي تصمّمها قبل التسجيل",
        body: [
          "تقدر تختار تصميمًا وتعبّي بيانات دعوتك قبل إنشاء حساب وقبل الدفع. في هذه المرحلة نحفظ ما تُدخله فعلًا: أسماء العريس والعروس والعائلتين، وتاريخ المناسبة ووقتها، واسم المكان والمنطقة، والتصميم واللون اللي اخترتهما — إضافةً إلى ما تعبّيه اختياريًا في صفحة التفاصيل مثل كنية أم العريس وأم العروس، ونص الافتتاحية والختام، وبرنامج الحفل والملاحظات ورابط الموقع والأغنية.",
          "ما دمت لم تسجّل الدخول فهذه الدعوة غير مرتبطة باسمك ولا برقم جوالك. المفتاح الوحيد إليها ملف ارتباط في متصفّحك، ولذلك من يفتح الرابط نفسه من متصفّح آخر لا يرى شيئًا. وعند تسجيل دخولك تنتقل الدعوة إلى حسابك وتصبح مرتبطة به.",
          "الدعوة قبل الدفع نسخة تجريبية عليها علامة مائية، ولا تُفهرس في محرّكات البحث، ولا يُنشأ لها رابط دعوة لأي مدعو ولا رمز دخول — هذي ما توجد إلا بعد التفعيل.",
          "الدعوة التي لم تُربط بحساب ولم تُفعَّل تُحذف نهائيًا بعد ٣٠ يومًا من آخر تعديل عليها، ويُحذف معها كل ما أُدخل فيها. وتقدر تحذفها بنفسك في أي وقت من زر «احذف هذه الدعوة» في صفحة الأساسيات في دعوتك.",
          "ولحماية الخدمة من الإساءة نسجّل عند بدء كل دعوة جديدة بصمة مشفّرة لعنوان الشبكة — لا العنوان نفسه — ونستخدمها لغرض واحد: تحديد عدد الدعوات التي يمكن بدؤها من الشبكة نفسها خلال ساعة. تُحذف هذه السجلات بعد أسبوع.",
        ],
      },
      {
        heading: "٣. مشاركة المعاينة قبل الدفع",
        body: [
          "تقدر ترسل رابط معاينة دعوتك لعدد محدود من الأشخاص قبل الدفع لتأخذ رأيهم. قبل الدفع يشوف من تشاركه النسخة التجريبية بعلامتها المائية فقط، ولا يقدر يرد على الدعوة ولا يحصل على بطاقة دخول. وبعد تفعيل دعوتك يعرض الرابط نفسه الدعوة بدون علامة مائية.",
          "لا نطلب من هذا الشخص أي بيانات ولا نعرف من هو. نكتفي بوضع ملفين في متصفّحه: واحد يحمل رقمًا عشوائيًا ليُحتسب مرة واحدة مهما أعاد فتح الرابط ويتوقف الرابط بعد ثلاثة أجهزة، وواحد يحمل معرّف الدعوة التي سُمح له بفتحها. لا يرتبط أي منهما باسم ولا برقم جوال ولا نستخدمهما لأي غرض آخر.",
          "تُحذف هذه السجلات تلقائيًا عند حذف الدعوة.",
        ],
      },
      {
        heading: "٤. كيف نستخدم البيانات",
        bullets: [
          "لتقديم الخدمة: إنشاء الدعوات وإرسالها وإدارة ردود الحضور والدخول.",
          "لمعالجة المدفوعات وإصدار تأكيدات الطلبات.",
          "لتحسين المنصة وحمايتها من إساءة الاستخدام.",
          "للتواصل معك بشأن طلبك أو الدعم الفني.",
        ],
      },
      {
        heading: "٥. مشاركة البيانات",
        body: [
          "لا نبيع بياناتك الشخصية. وقد نشاركها فقط في الحدود اللازمة مع:",
        ],
        bullets: [
          "مزوّد الدفع «ميسر» (Moyasar) لإتمام عمليات الدفع بأمان.",
          "مزوّدي الاستضافة والبنية التقنية الذين نشغّل عليهم الخدمة.",
          "خدمة خطوط Google (Google Fonts) التي يُحمّل منها متصفّحك خطوط التصميم.",
          "الجهات المختصة عند وجود التزام نظامي يقتضي ذلك.",
        ],
      },
      {
        heading: "٦. ملفات تعريف الارتباط (Cookies)",
        body: [
          "نستخدم ملفات ارتباط أساسية لتشغيل الموقع فقط، ولا نستخدم ملفات إعلانية ولا أدوات تتبّع أو تحليلات: ملف يحفظ جلسة دخولك، وملف لتفضيلاتك (اللغة والمظهر)، وملف يحفظ الدعوة التي تصمّمها في هذا المتصفّح قبل التسجيل ومدته ٣٠ يومًا، وملفان يُوضعان في متصفّح من تشاركه رابط المعاينة — واحد ليُحتسب مرة واحدة، وواحد يحمل معرّف الدعوة التي سُمح له بفتحها. يمكنك التحكم في ملفات الارتباط من إعدادات متصفّحك، مع العلم أن حذفها يعني فقدان الوصول إلى دعوة بدأتها قبل التسجيل، لأن هذا الملف هو مفتاحها الوحيد.",
        ],
      },
      {
        heading: "٧. الاحتفاظ بالبيانات",
        body: [
          "نحتفظ ببياناتك طوال المدة اللازمة لتقديم الخدمة والوفاء بالالتزامات النظامية والمحاسبية. أمّا الدعوة التي صُمّمت بدون تسجيل دخول ولم تُفعَّل فتُحذف نهائيًا بعد ٣٠ يومًا من آخر تعديل عليها، وتُحذف معها سجلات مشاركة معاينتها. وسجلات الحدّ من الإساءة (بصمة عنوان الشبكة المشفّرة) تُحذف بعد أسبوع. أمّا المناسبات المدفوعة وبيانات ضيوفها فتبقى محفوظة ما دام حسابك قائمًا، ويمكنك طلب حذفها بالتواصل معنا، مع مراعاة المدد النظامية لحفظ السجلات المحاسبية.",
        ],
      },
      {
        heading: "٨. حماية البيانات",
        body: [
          "نطبّق إجراءات تقنية وتنظيمية معقولة لحماية بياناتك، منها التشفير أثناء النقل والوصول المحدود. ومع ذلك لا يمكن ضمان أمان أي وسيلة نقل عبر الإنترنت بنسبة ١٠٠٪.",
        ],
      },
      {
        heading: "٩. حقوقك",
        body: [
          "وفقًا لنظام حماية البيانات الشخصية، يحق لك الوصول إلى بياناتك وطلب تصحيحها أو حذفها وسحب موافقتك، ضمن الحدود النظامية. لممارسة هذه الحقوق تواصل معنا عبر الوسائل الموضّحة أدناه. وإذا كنت تصمّم دعوة بدون تسجيل دخول، فأسرع طريق لحذف بياناتها هو زر «احذف هذه الدعوة» في صفحة الأساسيات في دعوتك — لأننا لا نستطيع التعرّف على دعوتك من رسالة تصلنا، فهي غير مرتبطة باسمك ولا برقم جوالك.",
        ],
      },
      {
        heading: "١٠. بيانات ضيوفك",
        body: [
          "عند إدخالك بيانات ضيوفك تكون أنت المسؤول عن الحصول على موافقتهم، وتلتزم باستخدامها لغرض الدعوة فقط. نعالج هذه البيانات نيابةً عنك لتشغيل الخدمة.",
        ],
      },
      {
        heading: "١١. تعديل السياسة",
        body: [
          "قد نُحدّث هذه السياسة، وننشر أي تحديث على هذه الصفحة مع تحديث تاريخ آخر مراجعة.",
        ],
      },
      {
        heading: "١٢. التواصل معنا",
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
          "الدعوة منتج رقمي. تصميمها ومعاينتها مجانًا، والمبلغ الذي تدفعه مقابل تفعيلها: رفع العلامة المائية، وإتاحة إنشاء روابط الدعوات للمدعوين، وبطاقات الدخول في الباقة التي تشملها، بعدد الدعوات الذي اشتريته. لا يوجد شحن ولا منتج مادي.",
        ],
      },
      {
        heading: "٢. الاسترجاع قبل إنشاء روابط المدعوين",
        body: [
          "يمكنك طلب إلغاء طلبك واسترجاع كامل المبلغ ما دمت لم تُنشئ رابط دعوة لأي مدعو بعد التفعيل. يكفي أن تتواصل معنا وتزوّدنا برقم الطلب.",
        ],
      },
      {
        heading: "٣. بعد إنشاء روابط المدعوين",
        body: [
          "بعد إنشاء روابط الدعوات للمدعوين أو إرسال أي منها، تكون الخدمة الرقمية قد قُدِّمت ولا يمكن استرجاع المبلغ، باستثناء الحالات الموضّحة في البند التالي.",
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
        heading: "2. Designing before you pay",
        body: [
          "Designing and previewing an invitation is free and requires neither an account nor payment. What you design before paying is a watermarked draft, not an invitation you can send: no link is created for any guest, no entry pass exists, and RSVP does not work on it.",
          "Before paying you can share the preview link with a limited number of people (three devices). That limit is housekeeping, not protection: it does not stop anyone who has seen the preview from screenshotting or copying what they were shown.",
          "An invitation designed without signing in is held in your browser by a cookie, and is permanently deleted 30 days after it was last edited if it is not linked to an account and not activated. Sign in to keep your invitation on your account.",
          "Paying activates the invitation: the watermark is removed and you can add guests and create their invitation links — that is the service you are paying for.",
        ],
      },
      {
        heading: "3. Accounts and registration",
        body: [
          "Some features require an account created with your mobile number and verified via a one-time code sent to you. You are responsible for the accuracy of the data you enter, for keeping your account access confidential, and for all activity that takes place through it.",
          "You must be at least 18 years old, or use the platform under the supervision of a guardian or a person with legal authority.",
        ],
      },
      {
        heading: "4. Pricing and payment",
        body: [
          "Prices are calculated based on the number of invitations and the options you choose, and the final cost is shown clearly before payment on the plans and checkout pages. The prices displayed at the time you place your order are the ones that apply.",
          "Payment is processed through the Moyasar payment gateway and supports mada, Visa, Mastercard and Apple Pay. We do not store your card details; payment data is processed directly by the payment provider under its security standards.",
        ],
      },
      {
        heading: "5. Digital delivery",
        body: [
          "Once payment succeeds, the purchased service becomes available in your account immediately, and you can prepare and share your invitation with your guests. Creating guest invitation links after activation is what counts as the actual start of performing the service.",
        ],
      },
      {
        heading: "6. Acceptable use and content",
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
        heading: "7. Intellectual property",
        body: [
          "The designs, templates, the Dawati brand and all platform elements are owned by or licensed to us and may not be copied or resold without permission. The event data you enter remains yours, and you grant us a limited licence to use it to operate the service for you.",
        ],
      },
      {
        heading: "8. Cancellation and refunds",
        body: [
          "Cancellations and refunds are governed by our Refund & Cancellation Policy, which forms part of these terms. Please review it to learn when a refund is available.",
        ],
      },
      {
        heading: "9. Limitation of liability",
        body: [
          "We make reasonable efforts to keep the service stable, but we do not guarantee it will be free of interruptions or errors. We are not liable for indirect damages, for errors in data you entered yourself, or for matters beyond our reasonable control. This does not limit any rights granted to you by law.",
        ],
      },
      {
        heading: "10. Privacy",
        body: [
          "Our Privacy Policy explains how we collect, use and protect your personal data, and it complements these terms.",
        ],
      },
      {
        heading: "11. Changes to these terms",
        body: [
          "We may update these terms from time to time. An update takes effect once published on this page, with the last-reviewed date updated. Continuing to use the platform after an update constitutes acceptance of it.",
        ],
      },
      {
        heading: "12. Governing law",
        body: [
          "These terms are governed by and construed in accordance with the laws of the Kingdom of Saudi Arabia, and the competent courts in the Kingdom have jurisdiction over any dispute arising from them.",
        ],
      },
      {
        heading: "13. Contact us",
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
          "Invitation data entered before registration: everything you enter into an invitation you design before creating an account and before paying — set out in the next section.",
          "Payment data: from the payment provider we receive only the transaction confirmation and the card's last digits and type; we do not store your full card number.",
          "Technical data: IP address, browser and device type, and usage logs for operation and security. When a new invitation is started without signing in, we store a hashed fingerprint of the network address rather than the address itself, to limit abuse.",
        ],
      },
      {
        heading: "2. The invitation you design before registering",
        body: [
          "You can choose a design and fill in your invitation before creating an account and before paying. At that stage we store what you actually enter: the groom's and bride's names and their families, the event date and time, the venue and region, and the design and colour you chose — plus anything you optionally add on the details page, such as the groom's mother's and the bride's mother's kunya, the opening and closing lines, the programme, the notes, the map link and the music.",
          "While you are not signed in, this invitation is not linked to your name or your mobile number. The only key to it is a cookie in your browser, which is why opening the same link from another browser shows nothing. When you sign in, the invitation moves onto your account.",
          "Before payment the invitation is a watermarked draft. It is not indexed by search engines, and no guest invitation link and no entry pass exist for it — those are created only on activation.",
          "An invitation that is never linked to an account and never activated is permanently deleted 30 days after it was last edited, together with everything entered into it. You can also delete it yourself at any time with the \"Delete this invitation\" button on your invitation's Basics page.",
          "To protect the service from abuse, each time a new invitation is started we record a hashed fingerprint of the network address — not the address itself — and use it for one purpose: limiting how many invitations can be started from the same network within an hour. These records are deleted after a week.",
        ],
      },
      {
        heading: "3. Sharing your preview before payment",
        body: [
          "Before paying you can send a preview link of your invitation to a small number of people for their opinion. Before payment they see only the watermarked draft; they cannot RSVP and they receive no entry pass. Once your invitation is activated, the same link shows it without the watermark.",
          "We ask that person for nothing and we do not know who they are. We only place two cookies in their browser: one carrying a random number, so the same person is counted once however often they reopen the link and the link stops after three devices, and one carrying the identifier of the invitation they were let into. Neither is linked to a name or a mobile number, and neither is used for anything else.",
          "These records are deleted automatically when the invitation is deleted.",
        ],
      },
      {
        heading: "4. How we use data",
        bullets: [
          "To provide the service: creating and sending invitations and managing RSVPs and entry.",
          "To process payments and issue order confirmations.",
          "To improve and protect the platform from misuse.",
          "To contact you about your order or for support.",
        ],
      },
      {
        heading: "5. Sharing data",
        body: [
          "We do not sell your personal data. We share it only as necessary with:",
        ],
        bullets: [
          "The Moyasar payment provider, to complete payments securely.",
          "Hosting and infrastructure providers we run the service on.",
          "Google Fonts, from which your browser loads the design's typefaces.",
          "Competent authorities where a legal obligation requires it.",
        ],
      },
      {
        heading: "6. Cookies",
        body: [
          "We use essential cookies only, to run the site — no advertising cookies and no analytics or tracking tools: one that keeps your sign-in session, one for your preferences (language and theme), one that holds the invitation you are designing in this browser before you register, for 30 days, and two placed in the browser of anyone you share your preview link with — one so that viewer is counted once, and one carrying the identifier of the invitation they were let into. You can control cookies from your browser settings, noting that clearing them means losing access to an invitation you started before registering, because that cookie is its only key.",
        ],
      },
      {
        heading: "7. Data retention",
        body: [
          "We keep your data for as long as needed to provide the service and to meet legal and accounting obligations. An invitation designed without signing in that is never activated is permanently deleted 30 days after it was last edited, along with the records of its preview sharing. The abuse-limiting records (the hashed network fingerprint) are deleted after a week. Paid events and their guest data remain while your account exists; you can ask us to delete them by contacting us, subject to the periods the law requires for keeping accounting records.",
        ],
      },
      {
        heading: "8. Data security",
        body: [
          "We apply reasonable technical and organisational measures to protect your data, including encryption in transit and limited access. However, no method of transmission over the internet can be guaranteed 100% secure.",
        ],
      },
      {
        heading: "9. Your rights",
        body: [
          "Under the Personal Data Protection Law, you have the right to access your data and to request its correction or deletion and to withdraw your consent, within the legal limits. To exercise these rights, contact us using the details below. If you are designing an invitation without being signed in, the fastest way to delete its data is the \"Delete this invitation\" button on your invitation's own Basics page — we cannot identify your invitation from a message you send us, because it is not linked to your name or your mobile number.",
        ],
      },
      {
        heading: "10. Your guests' data",
        body: [
          "When you enter your guests' data, you are responsible for obtaining their consent and undertake to use it only for the invitation. We process this data on your behalf to operate the service.",
        ],
      },
      {
        heading: "11. Changes to this policy",
        body: [
          "We may update this policy and will publish any update on this page with the last-reviewed date updated.",
        ],
      },
      {
        heading: "12. Contact us",
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
          "An invitation is a digital product. Designing and previewing it is free; what you pay for is activating it — removing the watermark, enabling guest invitation links, and entry passes where the option you bought includes them, up to the number of invitations you bought. There is no shipping and no physical product.",
        ],
      },
      {
        heading: "2. Refund before guest links are created",
        body: [
          "You may cancel your order and receive a full refund as long as you have not created an invitation link for any guest after activation. Simply contact us and provide your order number.",
        ],
      },
      {
        heading: "3. After guest links are created",
        body: [
          "Once guest invitation links have been created, or any of them sent, the digital service has been provided and the amount is non-refundable, except for the cases set out in the next section.",
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

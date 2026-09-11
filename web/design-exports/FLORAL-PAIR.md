# حديقة اللؤلؤ · ورد وفراشات

تصميمان محليان، كل تصميم أربع نسخ لونية وتسع صفحات دعوة. لم تُرفع الملفات ولم تُعدّل قاعدة البيانات. الرفع والنشر لكلاود فقط طبقًا لـ AGENTS.md.

المعاينة: http://127.0.0.1:3001/ar/themes/floral-review

- حديقة اللؤلؤ / pearl-garden: ivory, blush, sage, mist.
- ورد وفراشات / hibiscus-butterfly: burgundy, mauve, navy, mocha.

## ملفات التسليم
- `src/lib/themes/builder/floral-pair.ts`: مصدر التنسيق والألوان، يستخدم الخطوط والمشاهد من doveLayout.
- `public/themes/pearl-garden/{colour}/` و`public/themes/hibiscus-butterfly/{colour}/`: background.png وenvelopeClosed.png وenvelopeOpen.png؛ 24 صورة إجمالًا.
- `design-exports/pearl-garden.json` و`design-exports/hibiscus-butterfly.json`: تصديران بصيغة DRAFT؛ ليسا أوامر ترحيل أو نشر.
- الخلفية مستخدمة كذلك لبطاقة الدخول، مع QR منفصل وبيانات ضيف مرتبطة. card وcardNoQr يشيران إلى الخلفية نفسها.
- تحتاج الأظرف دعم AssetLayer.clipPolygon في types.ts وschema.ts وtheme-stage.tsx. الصور الخام تحتوي على خلفية خارج الظرف، ويستبعدها مسار القصّ في العارض والمحرر. لا تفصل الصور عن بيانات قصّها. راجع القص بعد تغيير نسب الصورة أو المشهد.
- الشمع سادة وطبقة s_cover_seal فارغة وقابلة للتعديل لإضافة الحروف.
- بيانات المعاينة ورمزها توضيحية، وتأكيد الحضور محاكاة.

## التحقق المحلي
من مجلد web:
```
node --import tsx scripts/export-floral-pair.ts
node --import tsx --test scripts/floral-pair.test.ts
npx tsc --noEmit
```
أنشئ تصميمين جديدين عند الاستيراد، ولا تستبدل التصاميم الحالية. راجع معاينة ضيف حقيقي قبل النشر، وحافظ على تعديلات المشروع الأخرى.

## مراجعة كلاود قبل النشر (11 سبتمبر 2026)
- موكا / ورد وفراشات: كان ورد الظرفين عنابيًا لا بنيًا، فبدا اللون نسخة ثانية من العنابي، بينما ورد الخلفية بني. أُعيد تلوين حبر الورد والفراشات فقط في `mocha/envelopeClosed.png` و`mocha/envelopeOpen.png`، بإزاحة درجة اللون 12° وتخفيف التشبّع 18%. القناع يلتقط الحبر المشبع الداكن فقط، فالورق والشمع وبطاقة الإدخال لم تتغيّر (متوسط فرق الورق 0.24 من 255).
- ورد وفراشات: عمود النص عرضه 52%، فعلى مسرح ~310px (جوال أندرويد 360px) كان التاريخ الهجري ينزل لسطر رابع، والصندوق يتحول لتمرير يخفي الوقت. صار تاريخ الترحيب أصغر بنقطتين، وأخذ صندوقا التاريخ والمكان في صفحة التفاصيل المساحة الفارغة أسفلها. تحقّق كاشف `data-text-overflow` أنه لا يوجد صندوق نص فائض على 390px و430px، بالنصوص العادية والطويلة.
- على مسرح أضيق (~280px) تفيض صفحة التفاصيل في كل التصاميم الخمسة عشر الحالية، وليس في هذين فقط. هذا خارج هذا التسليم.

## الصور وطريقة توليدها
استُخدمت أداة image_gen المدمجة، لا CLI. المرجعان: `/Users/sultan/Downloads/ -23.jpg` لحديقة اللؤلؤ، و`/Users/sultan/Downloads/ -22.jpg` للورد والفراشات.

Prompt set:
1. Background per colour: preserve reference floral composition and tactile photographic paper; portrait9:16; pale blank centre for dark text. Pearl Garden: sculpted roses, flowers and metallic sprigs around outer border in ivory/champagne, blush/rose-gold, pale sage, or mist blue/silver. Hibiscus Butterfly: hibiscus and butterflies along left, blank parchment on right, burgundy/mauve/navy/mocha accents. No text, QR or watermark.
2. Envelope per colour: existing dove envelope is ONLY an exact geometry reference; user floral image is style reference. Replace velvet with matte paper and doves with floral motif; coordinate palette; keep decorations within silhouette. Closed: landscape3:2, rectangle x3–97%,y12.5–87.5%, blank pearl wax at x50%,y65%. Open: portrait3:4, apexx50%,y1%, shouldersx5.3/94.7%,y36.7%, bottomy96.2%, insertx16–84%,y23–63%. Keep guest area clear, preserve ivory insert; no lettering, checkerboard or transparency attempt. Saved layout traces the actual outer edge.

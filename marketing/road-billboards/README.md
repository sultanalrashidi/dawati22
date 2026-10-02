# دعوتي: ترند «لوحات الطرق» (كاروسيل تيك توك)

**الفكرة:** صور لشوارع الرياض كأنها من داخل السيارة، وفوق الجسر لوحة إعلانية بهوية دعوتي. أول سطر في اللوحة هاجس أو شعور، والثاني يقلبه على دعوتي.

| الملف | وش فيه |
|---|---|
| `billboards.html` | تصميم اللوحات العشر. افتحه في المتصفح يطلع لك معرض، و`?board=3` يفتح لوحة وحدة بمقاسها الكامل |
| `png/` | اللوحات العشر بمقاس **2400×600** (4:1)، وصور الكاروسيل الأربع أسماؤها فيها `carousel-1` إلى `carousel-4`. وفيه **`scene-1.png` إلى `scene-4.png`**: مشاهد الكاروسيل جاهزة بمقاس 1080×1920 |
| `scenes.html` | المشاهد الأربعة مرسومة بالكود: السماء، وأبراج الرياض، والجسر، واللوحة فوقه، وداخل السيارة أو النفق |
| `render.mjs` | يعيد تصدير اللوحات والمشاهد إذا عدّلت أي عبارة: `node render.mjs` |
| `fonts/` و`logo.png` | الخطوط والشعار نفسها اللي في الموقع (`web/public/wallet-logo.png`) |

**الهوية المستخدمة:**
- **الخلفية:** كريمي ‎#F6ECE2، وهو نفس خلفية الشعار، والإطار ذهبي رفيع ‎#C9AE6B.
- **السطر الأول:** خط Amiri بلون الحبر ‎#241E12.
- **السطر الثاني:** خط Almarai ExtraBold بني ‎#5B3A22، نفس لون «د» في الشعار.
- **الشعار:** على اليمين، وتحته «دعوتي» بخط Aref Ruqaa، وهو خط الشعار في الموقع.
- **الرابط:** dawati.store صغير في الزاوية.

ما فيها أي لون أو شكل من لوحات المرور الرسمية، ولا شعار جهة حكومية.

---

## ١. العبارات العشر

| # | السطر الأول (الهاجس) | السطر الثاني (دعوتي) | الفكرة |
|---|---|---|---|
| 1 | ضاع الكرت.. وضاع معه العنوان | دعوتك توصل برسالة وما تضيع | ضياع كروت الورق |
| 2 | لا تقول: نسيت الموعد | ينضاف لتقويم جوالك بضغطة | الموعد والتقويم |
| 3 | أكثر سؤال سمعته: وين القاعة؟ | الموقع والموعد داخل الدعوة | الموقع على الخريطة |
| 4 | هاجسي ليلة الفرح: مين بيجي؟ | الردود توصلك أول بأول | متابعة الردود |
| 5 | بعض الحضور فرحة.. | وتأكيده راحة بال | تأكيد الحضور |
| 6 | اللمّة ما تكمل إلا فيك | أكّد حضورك.. ننتظرك | اللمة |
| 7 | أحلى بداية: اسمك على الدعوة | كل ضيف دعوته باسمه | الدعوة الشخصية |
| 8 | كرت الفرح صار في جيبك | بمحفظة جوالك مع الباركود | المحفظة |
| 9 | ليلة انتظرناها عمر.. | تستاهل دعوة تليق فيها | التصميم |
| 10 | أخاف أنسى أحد أعزمه.. | ضيوفك كلهم في قائمة وحدة | قائمة الضيوف |

## ٢. ترتيب الكاروسيل

1. **ضاع الكرت.. وضاع معه العنوان** ← دعوتك توصل برسالة وما تضيع (`scene-1.png`، جسر وقت الغروب)
   *ليش أول وحدة:* كل واحد ضاع منه كرت دعوة، والجواب واضح من أول قراءة.
2. **لا تقول: نسيت الموعد** ← ينضاف لتقويم جوالك بضغطة (`scene-2.png`، طريق سريع بالليل)
   *ليش:* تنقل الكلام من صاحب المناسبة إلى الضيف، وتبيّن ميزة ملموسة.
3. **أكثر سؤال سمعته: وين القاعة؟** ← الموقع والموعد داخل الدعوة (`scene-3.png`، طالع من نفق)
   *ليش:* سؤال يتكرر في كل قروب عائلة قبل الزواج، ويضحّك.
4. **هاجسي ليلة الفرح: مين بيجي؟** ← الردود توصلك أول بأول (`scene-4.png`، جسر وقت المغرب)
   *ليش آخر وحدة:* تقفل الكاروسيل على الهاجس الأكبر عند صاحب المناسبة، وفيها كلمة «هاجس» نفسها من روح الترند.

**عن المشاهد الجاهزة (`scene-*.png`):** مرسومة بالكود بأسلوب سينمائي، وليست صوراً حقيقية. تقدر تنزلها كذا، أو تولّد صوراً واقعية بالبرومبتات تحت وتركّب اللوحات عليها.

---

## ٣. برومبتات توليد الصور

**نصيحة قبل البرومبتات:** أغلب الأدوات تخرّب النص العربي. عشان كذا كل برومبت له نسختان:
- **(أ) مع النص:** للتجربة، وتنفع غالباً في ChatGPT.
- **(ب) لوحة فاضية:** تولّد الصورة باللوحة فاضية، وبعدها تركّب ملف `png/` المناسب فوقها في Canva أو CapCut أو Photoshop، وتضبط المنظور بأداة Perspective أو Distort.

المقاس **9:16** (1080×1920). في Midjourney أضف آخر البرومبت: `--ar 9:16 --style raw --v 7`

### الصورة ١: جسر وقت الغروب

**(أ)**
```
Photorealistic photo taken from inside a car driving on a wide multi-lane highway in Riyadh, Saudi Arabia, at golden hour sunset. Shot from the passenger seat through a clean windshield, dashboard edge and rear-view mirror slightly visible at the top and bottom of the frame, shallow depth of field on the glass. Ahead, a modern concrete overpass bridge crosses the highway, and mounted on top of the bridge is a large wide horizontal billboard (4:1 ratio) with a soft cream/ivory background (#F6ECE2), a thin double gold border, and elegant Arabic typography in two lines: top line in black calligraphic Naskh "ضاع الكرت.. وضاع معه العنوان" and bottom line in bold dark brown "دعوتك توصل برسالة وما تضيع". On the RIGHT side of the billboard a round logo: a dark brown Arabic letter "د" inside a thin tan circle, with the word "دعوتي" beneath it, separated from the text by a thin vertical gold line. Warm orange-pink sky, sun low behind the city, Riyadh skyline with modern towers and palm trees silhouetted, light traffic with warm reflections, subtle lens flare, cinematic, shot on iPhone 15 Pro, 24mm, ultra realistic, 9:16 vertical.
```
**(ب)** نفس البرومبت، لكن استبدل الجملة اللي تبدأ بـ `mounted on top of the bridge…` إلى آخر وصف الشعار بهذا:
```
mounted on top of the bridge is a large wide horizontal billboard (4:1 ratio), completely blank, plain flat cream/ivory surface with a thin gold border, no text, no logo, front-facing to the camera, evenly lit
```

### الصورة ٢: طريق سريع بالليل

**(أ)**
```
Photorealistic night photo taken from inside a car on a busy Riyadh highway, Saudi Arabia, around 9 pm. Camera behind the windshield from the passenger side, a few soft raindrop-free reflections of the dashboard lights on the glass. Streams of red tail lights and white headlights, tall modern towers lit up in the distance, warm sodium street lamps. A large wide horizontal billboard (4:1 ratio) mounted on top of a concrete highway overpass, softly backlit and glowing warm, cream/ivory background with a thin gold double border, elegant Arabic typography in two lines: top line in black calligraphic Naskh "لا تقول: نسيت الموعد", bottom line in bold dark brown "ينضاف لتقويم جوالك بضغطة". On the RIGHT side a round logo, a dark brown Arabic letter "د" inside a tan ring, with "دعوتي" beneath it. Slight motion blur on passing cars, cinematic, moody, shot on iPhone, 24mm, ultra realistic, 9:16 vertical.
```
**(ب)** بدّل وصف اللوحة بجملة اللوحة الفاضية، وأضف لها: `softly backlit, glowing warm at night`.

### الصورة ٣: طالع من نفق مع آخر الغروب

**(أ)**
```
Photorealistic photo from the driver's point of view inside a car exiting a long road tunnel in Riyadh, Saudi Arabia, at dusk just after sunset. The dark tunnel walls and orange tunnel lights frame the edges of the shot, the bright purple-orange sky opens up ahead. Right at the tunnel exit, a large wide horizontal billboard (4:1 ratio) is mounted above the road on a concrete overpass, with a soft cream background, thin gold border and elegant Arabic text in two lines: top line in black calligraphic Naskh "أكثر سؤال سمعته: وين القاعة؟", bottom line in bold dark brown "الموقع والموعد داخل الدعوة". On the RIGHT side of the billboard a round logo: dark brown Arabic letter "د" in a thin tan circle with "دعوتي" written beneath it. Steering wheel and hands softly out of focus at the bottom, car tail lights ahead glowing red, gentle motion blur on the tunnel walls, cinematic contrast, ultra realistic, 9:16 vertical.
```
**(ب)** بدّل وصف اللوحة بنفس جملة «اللوحة الفاضية» حقت الصورة ١.

### الصورة ٤: جسر وقت المغرب والسماء زرقاء

**(أ)**
```
Photorealistic photo from inside a car stopped in light evening traffic on a wide road in Riyadh, Saudi Arabia, during blue hour right after sunset. Deep blue sky with a last thin orange glow on the horizon, rows of tall palm trees on the median, street lamps just turning on. Ahead, a large wide horizontal billboard (4:1 ratio) on top of a modern overpass bridge, softly illuminated, cream/ivory background, thin gold border, elegant Arabic text in two lines: top line in black calligraphic Naskh "هاجسي ليلة الفرح: مين بيجي؟", bottom line in bold dark brown "الردود توصلك أول بأول". On the RIGHT side a round logo, dark brown Arabic letter "د" inside a thin tan circle with "دعوتي" beneath it. Part of the side mirror and A-pillar visible on the edge of the frame, a phone on the dashboard mount slightly out of focus, calm and emotional mood, cinematic, ultra realistic, 9:16 vertical.
```
**(ب)** بدّل وصف اللوحة بجملة اللوحة الفاضية حقت الصورة ١.

**Negative prompt** (للأدوات اللي تقبله):
```
green or blue traffic sign, government logo, road sign, misspelled Arabic, broken Arabic letters, disconnected letters, Latin text on billboard, watermark, extra logos, cartoon, illustration, oversaturated
```

**نصائح للتركيب:**
- اجعل اللوحة تاخذ تقريباً ثلث عرض الصورة، عشان تبان طبيعية ويبقى النص مقروء على الجوال.
- إذا كانت الصورة ليلية، خفّف سطوع الـ PNG شوي وأضف توهّج خفيف، عشان تبان اللوحة مضاءة من داخل.
- حط التركيب في النص العلوي من الصورة. الجزء السفلي تغطيه أزرار تيك توك والكابشن.

---

## ٤. كابشن المنشور

```
ضاع الكرت؟ نسيتوا الموعد؟ وكل شوي أحد يسأل: وين القاعة؟ 😅
من اليوم الدعوة توصل برسالة، فيها الموقع والموعد، وتنضاف لتقويم الجوال بضغطة، والردود توصلك أول بأول 🤍

صمم دعوتك وشوفها قبل ما تدفع: dawati.store

ملاحظة: الصور مصممة رقمياً ✨

#دعوتي #دعوات_زواج #دعوة_الكترونية #دعوات_الكترونية #زواج #زواجات_السعودية #عروس #عروس_2026 #تجهيزات_العروس #الرياض #لوحات_الطرق #ترند #السعودية
```

> **إذا استخدمت صور مولّدة من أداة ذكاء اصطناعي** بدل `scene-*.png`، غيّر الملاحظة إلى «الصور مولّدة بالذكاء الاصطناعي ✨».

> **تذكير:** إذا كانت الصور من أداة ذكاء اصطناعي، فعّل خيار «محتوى مولّد بالذكاء الاصطناعي» (AI-generated content) في إعدادات المنشور في تيك توك.

## ٥. الكومنت المثبّت

```
لو عندك لوحة على طريقك… وش تكتب عليها؟ 🛣️
اكتب عبارتك عن الدعوات واللمّة وليلة الفرح، وأحلى عبارة بنحطها على لوحة في الجزء الثاني ونمنشنك 🤍
```

---

## ملاحظات على الصحة (من كود الموقع)

- **المحفظة:** الكود يدعم **Apple Wallet وGoogle Wallet**، ومع خيار «بباركود» فقط. جوالات سامسونج (أندرويد) يطلع لها زر Google Wallet (`web/src/lib/wallet/platform.ts`)، فتقدر تحفظ البطاقة في Google Wallet. تطبيق Samsung Wallet نفسه غير مدعوم. اللوحة ٨ تقول «بمحفظة جوالك مع الباركود» بدون ما تسمّي محفظة.
- **التقويم:** زر «أضيفوها إلى تقويمكم» موجود داخل الدعوة، فاللوحة ٢ صحيحة.
- **قائمة الضيوف:** المضيف يلصق قائمة ضيوفه دفعة وحدة بعد التفعيل، فاللوحة ١٠ صحيحة.
- **«الردود توصلك أول بأول»:** الردود تتجمع في صفحة المناسبة. ما في إشعار فوري يوصل للجوال، والعبارة ما تدّعي هذا.
- **«كل ضيف دعوته باسمه»:** لكل ضيف رابط خاص، واسمه يظهر داخل الدعوة.

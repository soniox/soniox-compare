export type CompareTtsSampleType =
  | "appointment"
  | "delivery"
  | "billing"
  | "contact";

export interface CompareTtsSample {
  type: CompareTtsSampleType;
  label: string;
  text: string;
}

export interface CompareTtsLanguageSamples {
  language: string;
  samples: CompareTtsSample[];
}

export const TTS_SAMPLES: Record<string, CompareTtsSample[]> = {
  // Afrikaans
  af: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Jou afspraak is bevestig vir Dinsdag, 15 Maart 2026 om 15:30. Bel +27-11-123-4567 om te herbeplan.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Jou bestelling SXN-7H3-KQ9 sal afgelewer word by Kerkstraat 128, Kaapstad 8001 tussen 09:00 en 17:30. Opsporing UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Jou saldo van R 24,500.00 is betaalbaar op 15 Maart 2026, met 'n 2.5% laat fooi na 30 dae. Kwitansies gestuur na j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Bevestig asseblief jou kontakbesonderhede: Yuki Takahashi, selfoon +27-82-555-0142, e-pos fatima.al-rashid@example.co.uk.",
    },
  ],
  // Albanian
  sq: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Takimi juaj është konfirmuar të martën, 15 mars 2026, në orën 15:30. Telefononi +355-4-123-4567 për të rregulluar orarin.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Porosia juaj SXN-7H3-KQ9 do të mbërrijë në Rr. Myslym Shyri 42, 1001 Tiranë mes orës 09:00 dhe 17:30. Ndjekja UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Fatura juaj prej 125.000 lekë duhet paguar më 15 mars 2026, me një kamatë vonese prej 2,5 % pas 30 ditësh. Faturat janë dërguar në j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Ju lutemi konfirmoni të dhënat e kontaktit: Yuki Takahashi, celular +355-69-555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Arabic
  ar: [
    {
      type: "appointment",
      label: "Appointment",
      text: "تم تأكيد موعدك يوم الثلاثاء 15 مارس 2026 الساعة 3:30 مساءً. اتصل على +966-11-123-4567 لإعادة جدولته.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "سيصل طلبك SXN-7H3-KQ9 إلى شارع العليا 2250، الرياض 12214 بين الساعة 9:00 صباحاً و 5:30 مساءً. رقم التتبع UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "فاتورتك بقيمة 4,875 ريال مستحقة في 15 مارس 2026، مع غرامة تأخير 2.5% بعد 30 يوماً. تم إرسال الإيصالات إلى j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "يرجى تأكيد بيانات الاتصال: Yuki Takahashi، جوال +966-50-555-0142، بريد إلكتروني fatima.al-rashid@example.co.uk.",
    },
  ],
  // Armenian
  hy: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Ձեր այցը հաստատված է երեքշաբթի, 2026 թվականի մարտի 15-ին, ժամը 15:30-ին։ Վերանշանակելու համար զանգահարեք +374-10-123-456։",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Ձեր SXN-7H3-KQ9 պատվերը կառաքվի Աբովյան փողոց 42, Երևան 0001 հասցեով՝ 09:00-ից 17:30-ն ընկած ժամանակահատվածում։ Հետևում՝ UPS-1Z999AA10։",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ձեր 520 000 ֏ հաշիվը ենթակա է վճարման 2026 թվականի մարտի 15-ին, 30 օր հետո կկիրառվի 2,5% տույժ։ Անդորրագրերն ուղարկվել են j.patel@clinic-health.co.uk հասցեին։",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Խնդրում ենք հաստատել ձեր կոնտակտային տվյալները՝ Yuki Takahashi, բջջային +374-91-555-142, էլ. փոստ fatima.al-rashid@example.co.uk։",
    },
  ],
  // Assamese
  as: [
    {
      type: "appointment",
      label: "Appointment",
      text: "আপোনাৰ এপইণ্টমেণ্ট মংগলবাৰ, 15 মাৰ্চ 2026, আবেলি 3:30 বজাৰ বাবে নিশ্চিত কৰা হৈছে। সময় সলনি কৰিবলৈ +91-361-123-4567 নম্বৰত ফোন কৰক।",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "আপোনাৰ অৰ্ডাৰ SXN-7H3-KQ9 জি এছ ৰোড 42, গুৱাহাটী 781005 ঠিকনাত পুৱা 9:00 বজাৰ পৰা আবেলি 5:30 বজাৰ ভিতৰত পৌঁছিব। ট্ৰেকিং UPS-1Z999AA10।",
    },
    {
      type: "billing",
      label: "Billing",
      text: "আপোনাৰ ₹1,08,450 ৰ বিল 15 মাৰ্চ 2026 ত পৰিশোধ কৰিব লাগিব, 30 দিনৰ পিছত 2.5% বিলম্ব মাচুল লাগু হ'ব। ৰচিদবোৰ j.patel@clinic-health.co.uk লৈ পঠিওৱা হৈছে।",
    },
    {
      type: "contact",
      label: "Contact",
      text: "অনুগ্ৰহ কৰি আপোনাৰ যোগাযোগৰ বিৱৰণ নিশ্চিত কৰক: Yuki Takahashi, ম'বাইল +91-94350-55142, ইমেইল fatima.al-rashid@example.co.uk।",
    },
  ],
  // Azerbaijani
  az: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Görüşünüz 15 mart 2026-cı il çərşənbə axşamı saat 15:30-a təsdiqləndi. Yenidən təyin etmək üçün +994-12-123-45-67 nömrəsinə zəng edin.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "SXN-7H3-KQ9 sifarişiniz Nizami küç. 42, Bakı AZ1000 ünvanına saat 09:00 ilə 17:30 arasında çatdırılacaq. İzləmə UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "2.450 ₼ məbləğindəki hesabınız 15 mart 2026-cı ildə ödənilməlidir, 30 gündən sonra 2,5% gecikmə cəriməsi tətbiq olunur. Qəbzlər j.patel@clinic-health.co.uk ünvanına göndərildi.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Zəhmət olmasa əlaqə məlumatlarınızı təsdiqləyin: Yuki Takahashi, mobil +994-50-555-0142, e-poçt fatima.al-rashid@example.co.uk.",
    },
  ],
  // Basque
  eu: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Zure hitzordua 2026ko martxoaren 15ean, asteartean, 15:30ean baieztatu da. Deitu +34-94-123-4567 telefonora berriz antolatzeko.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Zure SXN-7H3-KQ9 eskaera Gran Via 24, 48001 Bilbo helbidera iritsiko da 09:00 eta 17:30 artean. Jarraipena UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Zure 1.299,50 €-ko faktura 2026ko martxoaren 15ean mugaeguneratuko da, eta %2,5eko berandutza interesa aplikatuko da 30 egun ondoren. Ordainagiriak j.patel@clinic-health.co.uk helbidera bidali dira.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Mesedez, berretsi zure harremanetarako datuak: Yuki Takahashi, mugikorra +34-688-555-142, e-posta fatima.al-rashid@example.co.uk.",
    },
  ],
  // Belarusian
  be: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Ваш прыём пацверджаны на аўторак, 15 сакавіка 2026 года, у 15:30. Патэлефануйце па +375-17-123-45-67, каб перанесці.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Ваша замова SXN-7H3-KQ9 будзе дастаўлена па адрасе вул. Нямiга 10, 220030 Мінск з 09:00 да 17:30. Адсочванне UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ваш рахунак на суму 3.250,00 Br падлягае аплаце 15 сакавіка 2026 года, з пеней 2,5% пасля 30 дзён. Квітанцыі адпраўлены на j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Калі ласка, пацвердзіце кантактныя дадзеныя: Yuki Takahashi, мабільны +375-29-555-0142, электронная пошта fatima.al-rashid@example.co.uk.",
    },
  ],
  // Bengali
  bn: [
    {
      type: "appointment",
      label: "Appointment",
      text: "আপনার অ্যাপয়েন্টমেন্ট মঙ্গলবার, 15 মার্চ 2026, বিকাল 3:30 টায় নিশ্চিত করা হয়েছে। পুনঃনির্ধারণের জন্য +880-2-1234-5678 নম্বরে কল করুন।",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "আপনার অর্ডার SXN-7H3-KQ9 গুলশান অ্যাভিনিউ 42, ঢাকা 1212 ঠিকানায় সকাল 9:00 থেকে বিকাল 5:30 এর মধ্যে পৌঁছাবে। ট্র্যাকিং UPS-1Z999AA10।",
    },
    {
      type: "billing",
      label: "Billing",
      text: "আপনার ৳142,500 টাকার চালান 15 মার্চ 2026 তারিখে পরিশোধযোগ্য, 30 দিন পর 2.5% বিলম্ব ফি প্রযোজ্য হবে। রসিদগুলি j.patel@clinic-health.co.uk-এ পাঠানো হয়েছে।",
    },
    {
      type: "contact",
      label: "Contact",
      text: "অনুগ্রহ করে আপনার যোগাযোগের বিবরণ নিশ্চিত করুন: Yuki Takahashi, মোবাইল +880-17-555-0142, ইমেইল fatima.al-rashid@example.co.uk।",
    },
  ],
  // Bosnian
  bs: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Vaš pregled potvrđen je za utorak, 15. marta 2026. u 15:30. Nazovite +387-33-123-456 za promjenu termina.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Vaša narudžba SXN-7H3-KQ9 stići će na adresu Ferhadija 18, 71000 Sarajevo između 09:00 i 17:30. Praćenje UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Vaš račun u iznosu od 2.450,00 KM dospijeva 15. marta 2026, uz zateznu kamatu od 2,5% nakon 30 dana. Potvrde su poslane na j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Molimo potvrdite kontakt podatke: Yuki Takahashi, mobitel +387-61-555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Bulgarian
  bg: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Вашият час е потвърден за вторник, 15 март 2026 г., в 15:30 ч. Обадете се на +359-2-123-4567, за да го пренасрочите.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Вашата поръчка SXN-7H3-KQ9 ще бъде доставена на бул. Витоша 45, 1000 София между 09:00 и 17:30 ч. Проследяване UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Вашата фактура за 2 450,00 лв. е с падеж 15 март 2026 г., с лихва за забавяне от 2,5% след 30 дни. Разписките са изпратени на j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Моля, потвърдете данните за контакт: Yuki Takahashi, мобилен +359-88-555-0142, имейл fatima.al-rashid@example.co.uk.",
    },
  ],
  // Catalan
  ca: [
    {
      type: "appointment",
      label: "Appointment",
      text: "La vostra visita està confirmada per dimarts, 15 de març de 2026, a les 15:30. Truqueu al +34-93-123-4567 per canviar l'hora.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "La vostra comanda SXN-7H3-KQ9 arribarà al Carrer de Balmes 120, 08008 Barcelona entre les 09:00 i les 17:30. Seguiment UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "La vostra factura de 1.299,50 € venç el 15 de març de 2026, amb un recàrrec del 2,5% després de 30 dies. S'han enviat els rebuts a j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Si us plau, confirmeu les vostres dades de contacte: Yuki Takahashi, mòbil +34-688-555-142, correu fatima.al-rashid@example.co.uk.",
    },
  ],
  // Cebuano
  ceb: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Ang imong appointment gikumpirma sa Martes, Marso 15, 2026, alas 3:30 sa hapon. Tawag sa +63-32-123-4567 aron usbon ang iskedyul.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Ang imong order SXN-7H3-KQ9 ihatod sa 42 Osmeña Boulevard, Cebu City 6000 tali sa alas 9:00 sa buntag ug alas 5:30 sa hapon. Tracking UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ang imong bayranan nga ₱45,800.00 kinahanglang bayran sa Marso 15, 2026, nga adunay 2.5% nga multa sa ulahing bayad human sa 30 ka adlaw. Ang mga resibo gipadala sa j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Palihug kumpirmaha ang imong mga detalye sa kontak: Yuki Takahashi, mobile +63-917-555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Chichewa
  ny: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Nthawi yanu yokumana yatsimikiziridwa Lachiwiri, 15 Marichi 2026 nthawi ya 15:30. Imbani +265-1-123-456 kuti musinthe nthawi.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Oda yanu SXN-7H3-KQ9 idzaperekedwa ku 42 Kamuzu Procession Road, Lilongwe pakati pa 9:00 ndi 17:30. Kutsatira UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Bilu yanu ya MK 850,000.00 ikuyenera kulipidwa pa 15 Marichi 2026, ndi chindapusa cha 2.5% cha kuchedwa pambuyo pa masiku 30. Malisiti atumizidwa ku j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Chonde tsimikizirani zambiri zanu zolumikizirana: Yuki Takahashi, foni ya m'manja +265-99-555-0142, imelo fatima.al-rashid@example.co.uk.",
    },
  ],
  // Chinese
  zh: [
    {
      type: "appointment",
      label: "Appointment",
      text: "您的预约已确认，时间为 2026年3月15日 星期二 下午3:30。如需改期，请致电 +86-10-1234-5678。",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "您的订单 SXN-7H3-KQ9 将于上午9:00至下午5:30之间送达北京市朝阳区建国路88号，邮编100022。快递追踪号 UPS-1Z999AA10。",
    },
    {
      type: "billing",
      label: "Billing",
      text: "您 ¥9,280.50 的账单将于 2026年3月15日 到期，逾期30天将收取 2.5% 的滞纳金。收据已发送至 j.patel@clinic-health.co.uk。",
    },
    {
      type: "contact",
      label: "Contact",
      text: "请确认您的联系方式：Yuki Takahashi，手机 +86-138-0013-8000，邮箱 fatima.al-rashid@example.co.uk。",
    },
  ],
  // Croatian
  hr: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Vaš pregled potvrđen je za utorak, 15. ožujka 2026. u 15:30. Nazovite +385-1-1234-567 za promjenu termina.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Vaša narudžba SXN-7H3-KQ9 stići će na adresu Ilica 42, 10000 Zagreb između 09:00 i 17:30 sati. Praćenje UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Vaš račun od 1.299,50 € dospijeva 15. ožujka 2026, uz zateznu kamatu od 2,5% nakon 30 dana. Potvrde su poslane na j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Molimo potvrdite svoje kontakt podatke: Yuki Takahashi, mobitel +385-91-555-0142, e-pošta fatima.al-rashid@example.co.uk.",
    },
  ],
  // Czech
  cs: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Vaše návštěva je potvrzena na úterý 15. března 2026 v 15:30. Pro změnu termínu volejte +420-2-1234-5678.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Vaše objednávka SXN-7H3-KQ9 bude doručena na adresu Václavské nám. 28, 110 00 Praha 1 mezi 09:00 a 17:30. Sledování UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Vaše faktura ve výši 32 450,00 Kč je splatná 15. března 2026, s úrokem z prodlení 2,5 % po 30 dnech. Účtenky byly zaslány na j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Prosím potvrďte své kontaktní údaje: Yuki Takahashi, mobil +420-602-555-142, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Danish
  da: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Din aftale er bekræftet til tirsdag den 15. marts 2026 kl. 15:30. Ring til +45-33-12-34-56 for at ombooke.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Din ordre SXN-7H3-KQ9 leveres på Nørrebrogade 42, 2200 København N mellem kl. 09:00 og 17:30. Sporing UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Din faktura på 9.450,00 kr. forfalder den 15. marts 2026, med en morarente på 2,5% efter 30 dage. Kvitteringer er sendt til j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Bekræft venligst dine kontaktoplysninger: Yuki Takahashi, mobil +45-20-55-01-42, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Dutch
  nl: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Uw afspraak is bevestigd voor dinsdag 15 maart 2026 om 15:30. Bel +31-20-123-4567 om te verzetten.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Uw bestelling SXN-7H3-KQ9 wordt bezorgd op Herengracht 128, 1015 BT Amsterdam tussen 09:00 en 17:30 uur. Tracering UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Uw factuur van € 1.299,50 vervalt op 15 maart 2026, met een vertragingsrente van 2,5% na 30 dagen. Bonnen zijn verstuurd naar j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Bevestig alstublieft uw contactgegevens: Yuki Takahashi, mobiel +31-6-5555-0142, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // English
  en: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Your appointment is confirmed for Tuesday, March 15, 2026 at 3:30 PM. Call +1-800-555-0199 to reschedule.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Your order SXN-7H3-KQ9 will arrive at 4250 Harrison Blvd., San Francisco, CA 94103 between 9:00 AM and 5:30 PM. Tracking UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Your balance of $1,299.50 is due March 15, 2026, with a 2.5% late fee after 30 days. Receipts sent to j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Please confirm your contact details: Yuki Takahashi, mobile +1-415-555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Estonian
  et: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Teie vastuvõtt on kinnitatud teisipäeval, 15. märtsil 2026 kell 15:30. Aja muutmiseks helistage +372-6-123-456.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Teie tellimus SXN-7H3-KQ9 saabub aadressile Viru tn 12, 10140 Tallinn kella 09:00 ja 17:30 vahel. Jälgimisnumber UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Teie arve summas 1 299,50 € tuleb tasuda 15. märtsil 2026, viivis 2,5% rakendub 30 päeva pärast. Kviitungid on saadetud aadressile j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Palun kinnitage oma kontaktandmed: Yuki Takahashi, mobiil +372-5-555-0142, e-post fatima.al-rashid@example.co.uk.",
    },
  ],
  // Finnish
  fi: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Tapaamisesi on vahvistettu tiistaina 15. maaliskuuta 2026 klo 15:30. Soita numeroon +358-9-123-4567 siirtääksesi aikaa.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Tilauksesi SXN-7H3-KQ9 toimitetaan osoitteeseen Mannerheimintie 42, 00100 Helsinki klo 09:00–17:30 välillä. Seuranta UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Laskusi 1 299,50 € erääntyy 15. maaliskuuta 2026, ja 30 päivän jälkeen peritään 2,5 % viivästyskorko. Kuitit on lähetetty osoitteeseen j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Vahvista yhteystietosi: Yuki Takahashi, matkapuhelin +358-40-555-0142, sähköposti fatima.al-rashid@example.co.uk.",
    },
  ],
  // French
  fr: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Votre rendez-vous est confirmé pour le mardi 15 mars 2026 à 15h30. Appelez le +33-1-23-45-67-89 pour le reporter.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Votre commande SXN-7H3-KQ9 sera livrée au 42 rue de Rivoli, 75004 Paris entre 9h00 et 17h30. Suivi UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Votre facture de 1 299,50 € est due le 15 mars 2026, avec des pénalités de 2,5 % après 30 jours. Les reçus ont été envoyés à j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Merci de confirmer vos coordonnées : Yuki Takahashi, mobile +33-6-12-34-56-78, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Galician
  gl: [
    {
      type: "appointment",
      label: "Appointment",
      text: "A súa cita está confirmada para o martes, 15 de marzo de 2026, ás 15:30. Chame ao +34-98-123-4567 para cambiala.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "O seu pedido SXN-7H3-KQ9 chegará á Rúa do Vilar 24, 15705 Santiago de Compostela entre as 09:00 e as 17:30. Seguimento UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "A súa factura de 1.299,50 € vence o 15 de marzo de 2026, cunha recarga do 2,5% despois de 30 días. Os recibos enviáronse a j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Confirme os seus datos de contacto: Yuki Takahashi, móbil +34-688-555-142, correo fatima.al-rashid@example.co.uk.",
    },
  ],
  // Georgian
  ka: [
    {
      type: "appointment",
      label: "Appointment",
      text: "თქვენი ვიზიტი დადასტურებულია სამშაბათს, 2026 წლის 15 მარტს, 15:30-ზე. დროის შესაცვლელად დარეკეთ +995-32-212-3456.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "თქვენი შეკვეთა SXN-7H3-KQ9 მიეწოდება მისამართზე რუსთაველის გამზირი 42, თბილისი 0108, 9:00-დან 17:30-მდე. თვალყურის დევნება UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "თქვენი ანგარიში 3 450,00 ₾ ოდენობით გადასახდელია 2026 წლის 15 მარტს, 30 დღის შემდეგ დაირიცხება 2,5% საურავი. ქვითრები გაიგზავნა j.patel@clinic-health.co.uk-ზე.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "გთხოვთ, დაადასტუროთ თქვენი საკონტაქტო მონაცემები: Yuki Takahashi, მობილური +995-555-55-01-42, ელფოსტა fatima.al-rashid@example.co.uk.",
    },
  ],
  // German
  de: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Ihr Termin ist für Dienstag, den 15. März 2026 um 15:30 Uhr bestätigt. Rufen Sie +49-30-12345678 an, um den Termin zu verschieben.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Ihre Bestellung SXN-7H3-KQ9 wird zwischen 09:00 und 17:30 Uhr in der Friedrichstr. 42, 10117 Berlin zugestellt. Sendungsnummer UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ihre Rechnung über 1.299,50 € ist am 15. März 2026 fällig, mit einer Mahngebühr von 2,5 % nach 30 Tagen. Quittungen wurden an j.patel@clinic-health.co.uk gesendet.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Bitte bestätigen Sie Ihre Kontaktdaten: Yuki Takahashi, Mobil +49-171-5550142, E-Mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Greek
  el: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Το ραντεβού σας επιβεβαιώνεται για την Τρίτη, 15 Μαρτίου 2026, στις 15:30. Καλέστε στο +30-21-1234-5678 για επαναπρογραμματισμό.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Η παραγγελία σας SXN-7H3-KQ9 θα παραδοθεί στην οδό Ερμού 42, 10563 Αθήνα μεταξύ 09:00 και 17:30. Παρακολούθηση UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Το τιμολόγιό σας ύψους 1.299,50 € λήγει στις 15 Μαρτίου 2026, με τόκο υπερημερίας 2,5% μετά από 30 ημέρες. Οι αποδείξεις έχουν σταλεί στο j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Παρακαλούμε επιβεβαιώστε τα στοιχεία επικοινωνίας σας: Yuki Takahashi, κινητό +30-69-5555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Gujarati
  gu: [
    {
      type: "appointment",
      label: "Appointment",
      text: "તમારી એપોઇન્ટમેન્ટ મંગળવાર, 15 માર્ચ 2026 ના રોજ સાંજે 3:30 વાગ્યે પુષ્ટિ થઈ છે. ફરીથી શેડ્યૂલ કરવા માટે +91-79-1234-5678 પર કોલ કરો.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "તમારો ઓર્ડર SXN-7H3-KQ9 સીજી રોડ 42, અમદાવાદ 380006 ખાતે સવારે 9:00 અને સાંજે 5:30 વચ્ચે પહોંચશે. ટ્રેકિંગ UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "તમારું ₹1,08,450 નું બિલ 15 માર્ચ 2026 ના રોજ બાકી છે, 30 દિવસ પછી 2.5% વિલંબ ફી લાગુ થશે. રસીદો j.patel@clinic-health.co.uk પર મોકલવામાં આવી છે.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "કૃપા કરીને તમારી સંપર્ક વિગતો પુષ્ટિ કરો: Yuki Takahashi, મોબાઇલ +91-98250-55142, ઇમેઇલ fatima.al-rashid@example.co.uk.",
    },
  ],
  // Hausa
  ha: [
    {
      type: "appointment",
      label: "Appointment",
      text: "An tabbatar da ganawarka ranar Talata, 15 ga Maris 2026 da ƙarfe 3:30 na yamma. Kira +234-9-123-4567 don sake tsara lokaci.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Za a kai odarka SXN-7H3-KQ9 zuwa Titin Ahmadu Bello 42, Kano 700001 tsakanin ƙarfe 9:00 na safe da 5:30 na yamma. Bin diddigi UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Kuɗin da ake bin ka na ₦185,000.00 za a biya shi ranar 15 ga Maris 2026, tare da tarar jinkiri ta 2.5% bayan kwanaki 30. An aika rasit zuwa j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Don Allah ka tabbatar da bayanan tuntuɓarka: Yuki Takahashi, wayar hannu +234-803-555-0142, imel fatima.al-rashid@example.co.uk.",
    },
  ],
  // Hebrew
  he: [
    {
      type: "appointment",
      label: "Appointment",
      text: "התור שלך אושר ליום שלישי, 15 במרץ 2026, בשעה 15:30. התקשרו ל-+972-3-123-4567 כדי לקבוע מחדש.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "ההזמנה שלך SXN-7H3-KQ9 תגיע לרח' דיזנגוף 128, תל אביב 6433401 בין השעות 09:00 ל-17:30. מעקב UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "החשבונית שלך על סך ₪4,850 תיפרע ב-15 במרץ 2026, עם ריבית פיגורים של 2.5% לאחר 30 ימים. הקבלות נשלחו ל-j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: 'נא לאשר את פרטי הקשר: Yuki Takahashi, נייד +972-52-555-0142, דוא"ל fatima.al-rashid@example.co.uk.',
    },
  ],
  // Hindi
  hi: [
    {
      type: "appointment",
      label: "Appointment",
      text: "आपकी अपॉइंटमेंट मंगलवार, 15 मार्च 2026 को शाम 3:30 बजे की पुष्टि हो गई है। पुनर्निर्धारण के लिए +91-11-1234-5678 पर कॉल करें।",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "आपका ऑर्डर SXN-7H3-KQ9 कनॉट प्लेस 42, नई दिल्ली 110001 पर सुबह 9:00 और शाम 5:30 के बीच पहुंचेगा। ट्रैकिंग UPS-1Z999AA10।",
    },
    {
      type: "billing",
      label: "Billing",
      text: "आपका ₹1,08,450 का बिल 15 मार्च 2026 को देय है, 30 दिनों के बाद 2.5% विलंब शुल्क लागू होगा। रसीदें j.patel@clinic-health.co.uk पर भेजी गई हैं।",
    },
    {
      type: "contact",
      label: "Contact",
      text: "कृपया अपने संपर्क विवरण की पुष्टि करें: Yuki Takahashi, मोबाइल +91-98100-55142, ईमेल fatima.al-rashid@example.co.uk।",
    },
  ],
  // Hungarian
  hu: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Időpontja 2026. március 15-én, kedden 15:30-ra van megerősítve. Új időpont egyeztetéséhez hívja a +36-1-123-4567 számot.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Az SXN-7H3-KQ9 rendelése 09:00 és 17:30 között érkezik a Váci utca 42., 1052 Budapest címre. Nyomkövetés UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Az Ön 485 000 Ft összegű számlája 2026. március 15-én esedékes, 30 nap után 2,5% késedelmi kamat érvényes. A bizonylatokat a j.patel@clinic-health.co.uk címre küldtük.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Kérjük, erősítse meg elérhetőségeit: Yuki Takahashi, mobil +36-20-555-0142, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Icelandic
  is: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Tíminn þinn er staðfestur þriðjudaginn 15. mars 2026 kl. 15:30. Hringdu í +354-512-3456 til að breyta tímanum.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Pöntunin þín SXN-7H3-KQ9 verður afhent á Laugavegi 42, 101 Reykjavík milli kl. 9:00 og 17:30. Rakning UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Reikningur þinn að upphæð 185.400 kr. er á gjalddaga 15. mars 2026, með 2,5% dráttarvöxtum eftir 30 daga. Kvittanir voru sendar á j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Vinsamlegast staðfestu tengiliðaupplýsingar þínar: Yuki Takahashi, farsími +354-855-0142, netfang fatima.al-rashid@example.co.uk.",
    },
  ],
  // Indonesian
  id: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Janji temu Anda telah dikonfirmasi untuk Selasa, 15 Maret 2026, pukul 15:30. Hubungi +62-21-1234-5678 untuk menjadwalkan ulang.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Pesanan Anda SXN-7H3-KQ9 akan tiba di Jl. Sudirman No. 42, Jakarta Pusat 10220 antara pukul 09:00 dan 17:30. Pelacakan UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Faktur Anda sebesar Rp 18.500.000 jatuh tempo pada 15 Maret 2026, dengan denda keterlambatan 2,5% setelah 30 hari. Kwitansi dikirim ke j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Mohon konfirmasi detail kontak Anda: Yuki Takahashi, ponsel +62-812-5555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Irish
  ga: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Tá do choinne deimhnithe don Mháirt, 15 Márta 2026 ag 15:30. Glaoigh ar +353-1-123-4567 chun an coinne a athshocrú.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Seachadfar d'ordú SXN-7H3-KQ9 chuig 42 Sráid Grafton, Baile Átha Cliath 2 idir 9:00 agus 17:30. Rianú UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Tá do bhille de €1,299.50 dlite ar 15 Márta 2026, le táille dhéanach 2.5% tar éis 30 lá. Seoladh na hadmhálacha chuig j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Deimhnigh do shonraí teagmhála, le do thoil: Yuki Takahashi, fón póca +353-87-555-0142, ríomhphost fatima.al-rashid@example.co.uk.",
    },
  ],
  // Italian
  it: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Il Suo appuntamento è confermato per martedì 15 marzo 2026 alle ore 15:30. Chiami il +39-06-1234-5678 per riprogrammarlo.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Il Suo ordine SXN-7H3-KQ9 sarà consegnato in Via del Corso 42, 00186 Roma tra le 09:00 e le 17:30. Tracciamento UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "La Sua fattura di 1.299,50 € scade il 15 marzo 2026, con una mora del 2,5% dopo 30 giorni. Le ricevute sono state inviate a j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "La preghiamo di confermare i Suoi dati di contatto: Yuki Takahashi, cellulare +39-333-555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Japanese
  ja: [
    {
      type: "appointment",
      label: "Appointment",
      text: "ご予約は 2026年3月15日 火曜日 午後3:30 で確定しております。予約の変更は +81-3-1234-5678 までお電話ください。",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "ご注文番号 SXN-7H3-KQ9 は 午前9:00 から 午後5:30 の間に 東京都港区赤坂4丁目2-7 〒107-0052 へお届けいたします。配送追跡番号は UPS-1Z999AA10 です。",
    },
    {
      type: "billing",
      label: "Billing",
      text: "¥142,500 のご請求書の支払期限は 2026年3月15日 です。30日を過ぎると 2.5% の延滞料が発生します。領収書は j.patel@clinic-health.co.uk へ送信されました。",
    },
    {
      type: "contact",
      label: "Contact",
      text: "ご連絡先をご確認ください。Yuki Takahashi 様、携帯 +81-90-5555-0142、メール fatima.al-rashid@example.co.uk。",
    },
  ],
  // Javanese
  jv: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Janjian panjenengan wis dikonfirmasi dina Selasa, 15 Maret 2026 jam 15.30. Telpon +62-274-123-456 kanggo ngganti jadwal.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Pesenan panjenengan SXN-7H3-KQ9 bakal dikirim menyang Jalan Malioboro 42, Yogyakarta 55271 antarane jam 09.00 lan 17.30. Pelacakan UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Tagihan panjenengan Rp 1.250.000 kudu dibayar tanggal 15 Maret 2026, kanthi denda telat 2,5% sawise 30 dina. Kuitansi wis dikirim menyang j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Mangga konfirmasi rincian kontak panjenengan: Yuki Takahashi, HP +62-812-5555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Kannada
  kn: [
    {
      type: "appointment",
      label: "Appointment",
      text: "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಮಂಗಳವಾರ, 15 ಮಾರ್ಚ್ 2026 ರಂದು ಸಂಜೆ 3:30 ಕ್ಕೆ ದೃಢಪಡಿಸಲಾಗಿದೆ. ಮರುನಿಗದಿಗಾಗಿ +91-80-1234-5678 ಗೆ ಕರೆ ಮಾಡಿ.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "ನಿಮ್ಮ ಆರ್ಡರ್ SXN-7H3-KQ9 ಎಂ.ಜಿ. ರಸ್ತೆ 42, ಬೆಂಗಳೂರು 560001 ಗೆ ಬೆಳಗ್ಗೆ 9:00 ಮತ್ತು ಸಂಜೆ 5:30 ನಡುವೆ ಬರಲಿದೆ. ಟ್ರ್ಯಾಕಿಂಗ್ UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "ನಿಮ್ಮ ₹1,08,450 ಬಿಲ್ 15 ಮಾರ್ಚ್ 2026 ರಂದು ಬಾಕಿ ಇದೆ, 30 ದಿನಗಳ ನಂತರ 2.5% ವಿಳಂಬ ಶುಲ್ಕ ಅನ್ವಯಿಸುತ್ತದೆ. ರಶೀದಿಗಳನ್ನು j.patel@clinic-health.co.uk ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿವರಗಳನ್ನು ದೃಢಪಡಿಸಿ: Yuki Takahashi, ಮೊಬೈಲ್ +91-98450-55142, ಇಮೇಲ್ fatima.al-rashid@example.co.uk.",
    },
  ],
  // Kazakh
  kk: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Кездесуіңіз 2026 жылдың 15 наурызы, сейсенбі күні сағат 15:30-ға белгіленді. Қайта жоспарлау үшін +7-727-123-4567 нөміріне қоңырау шалыңыз.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Сіздің SXN-7H3-KQ9 тапсырысыңыз Абай даңғылы 42, 050000 Алматы мекенжайына сағат 09:00 мен 17:30 аралығында жеткізіледі. Бақылау нөмірі UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "485 000 ₸ мөлшеріндегі есепшотыңыз 2026 жылдың 15 наурызында төленуі керек, 30 күннен кейін 2,5% өсімпұл қолданылады. Түбіртектер j.patel@clinic-health.co.uk мекенжайына жіберілді.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Байланыс деректеріңізді растаңыз: Yuki Takahashi, ұялы +7-701-555-0142, электрондық пошта fatima.al-rashid@example.co.uk.",
    },
  ],
  // Korean
  ko: [
    {
      type: "appointment",
      label: "Appointment",
      text: "예약이 2026년 3월 15일 화요일 오후 3:30로 확정되었습니다. 일정 변경은 +82-2-1234-5678로 전화해 주세요.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "주문 SXN-7H3-KQ9은(는) 서울특별시 강남구 테헤란로 42, 06234로 오전 9:00 부터 오후 5:30 사이에 배송됩니다. 배송 추적 번호 UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "₩1,450,000의 청구서는 2026년 3월 15일에 만기되며, 30일 후 2.5%의 연체료가 부과됩니다. 영수증은 j.patel@clinic-health.co.uk로 발송되었습니다.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "연락처를 확인해 주세요: Yuki Takahashi, 휴대폰 +82-10-5555-0142, 이메일 fatima.al-rashid@example.co.uk.",
    },
  ],
  // Kyrgyz
  ky: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Сиздин жолугушууңуз 2026-жылдын 15-мартына, шейшемби күнү саат 15:30га ырасталды. Убакытты өзгөртүү үчүн +996-312-123-456 номерине чалыңыз.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Сиздин SXN-7H3-KQ9 буйрутмаңыз Чүй проспекти 42, Бишкек 720001 дарегине саат 9:00дон 17:30га чейин жеткирилет. Көзөмөлдөө UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Сиздин 45 800 сом өлчөмүндөгү эсебиңиз 2026-жылдын 15-мартында төлөнүшү керек, 30 күндөн кийин 2,5% кечиктирүү айыбы колдонулат. Дүмүрчөктөр j.patel@clinic-health.co.uk дарегине жөнөтүлдү.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Сураныч, байланыш маалыматтарыңызды ырастаңыз: Yuki Takahashi, мобилдик +996-555-550-142, электрондук почта fatima.al-rashid@example.co.uk.",
    },
  ],
  // Latvian
  lv: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Jūsu vizīte ir apstiprināta otrdien, 2026. gada 15. martā plkst. 15:30. Zvaniet uz +371-6-123-4567, lai pārplānotu.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Jūsu pasūtījums SXN-7H3-KQ9 tiks piegādāts Brīvības ielā 42, Rīgā, LV-1010 starp plkst. 09:00 un 17:30. Izsekošana UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Jūsu rēķins 1 299,50 € apmērā ir jāsamaksā 2026. gada 15. martā, pēc 30 dienām tiek piemērota 2,5% kavējuma nauda. Kvītis nosūtītas uz j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Lūdzu, apstipriniet savus kontaktdatus: Yuki Takahashi, mobilais +371-2-555-0142, e-pasts fatima.al-rashid@example.co.uk.",
    },
  ],
  // Lithuanian
  lt: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Jūsų vizitas patvirtintas 2026 m. kovo 15 d., antradienį, 15:30. Norėdami perkelti laiką, skambinkite +370-5-123-4567.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Jūsų užsakymas SXN-7H3-KQ9 bus pristatytas adresu Gedimino pr. 42, LT-01103 Vilnius, nuo 09:00 iki 17:30. Stebėjimo numeris UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Jūsų 1 299,50 € sąskaita turi būti apmokėta 2026 m. kovo 15 d., po 30 dienų taikomi 2,5 % delspinigiai. Kvitai išsiųsti adresu j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Prašome patvirtinti kontaktinius duomenis: Yuki Takahashi, mobilusis +370-6-555-0142, el. paštas fatima.al-rashid@example.co.uk.",
    },
  ],
  // Macedonian
  mk: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Вашиот термин е потврден за вторник, 15 март 2026 година, во 15:30. Јавете се на +389-2-123-4567 за да го презакажете.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Вашата нарачка SXN-7H3-KQ9 ќе пристигне на ул. Македонија 42, 1000 Скопје помеѓу 09:00 и 17:30 часот. Следење UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Вашата фактура од 75.000 ден. достасува на 15 март 2026 година, со затезна камата од 2,5% по 30 дена. Признаниците се испратени на j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Ве молиме потврдете ги контакт податоците: Yuki Takahashi, мобилен +389-70-555-0142, e-пошта fatima.al-rashid@example.co.uk.",
    },
  ],
  // Malay
  ms: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Temu janji anda telah disahkan pada Selasa, 15 Mac 2026, pukul 3:30 petang. Hubungi +60-3-1234-5678 untuk menjadualkan semula.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Pesanan anda SXN-7H3-KQ9 akan tiba di Jalan Bukit Bintang 42, 55100 Kuala Lumpur antara pukul 9:00 pagi dan 5:30 petang. Penjejakan UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Invois anda berjumlah RM 5,850.00 akan matang pada 15 Mac 2026, dengan denda lewat 2.5% selepas 30 hari. Resit dihantar ke j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Sila sahkan butiran hubungan anda: Yuki Takahashi, telefon bimbit +60-12-555-0142, e-mel fatima.al-rashid@example.co.uk.",
    },
  ],
  // Malayalam
  ml: [
    {
      type: "appointment",
      label: "Appointment",
      text: "നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് ചൊവ്വാഴ്ച, 2026 മാർച്ച് 15-ന് വൈകുന്നേരം 3:30-ന് സ്ഥിരീകരിച്ചിരിക്കുന്നു. പുനഃക്രമീകരിക്കാൻ +91-471-123-4567 എന്ന നമ്പറിൽ വിളിക്കുക.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "നിങ്ങളുടെ ഓർഡർ SXN-7H3-KQ9 എം.ജി. റോഡ് 42, തിരുവനന്തപുരം 695001 എന്ന വിലാസത്തിൽ രാവിലെ 9:00 മുതൽ വൈകുന്നേരം 5:30 വരെയുള്ള സമയത്ത് എത്തും. ട്രാക്കിംഗ് UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "നിങ്ങളുടെ ₹1,08,450 ബിൽ 2026 മാർച്ച് 15-ന് അടയ്ക്കേണ്ടതാണ്, 30 ദിവസത്തിന് ശേഷം 2.5% വൈകി ഫീസ് ബാധകമാകും. രസീതുകൾ j.patel@clinic-health.co.uk-ലേക്ക് അയച്ചിട്ടുണ്ട്.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "ദയവായി നിങ്ങളുടെ കോൺടാക്റ്റ് വിവരങ്ങൾ സ്ഥിരീകരിക്കുക: Yuki Takahashi, മൊബൈൽ +91-94470-55142, ഇമെയിൽ fatima.al-rashid@example.co.uk.",
    },
  ],
  // Marathi
  mr: [
    {
      type: "appointment",
      label: "Appointment",
      text: "तुमची अपॉइंटमेंट मंगळवार, 15 मार्च 2026 रोजी संध्याकाळी 3:30 वाजता निश्चित झाली आहे. पुनर्नियोजनासाठी +91-20-1234-5678 वर कॉल करा.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "तुमचा ऑर्डर SXN-7H3-KQ9 फर्ग्युसन कॉलेज रोड 42, पुणे 411004 येथे सकाळी 9:00 आणि संध्याकाळी 5:30 दरम्यान पोहोचेल. ट्रॅकिंग UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "तुमचे ₹1,08,450 चे बिल 15 मार्च 2026 रोजी देय आहे, 30 दिवसांनंतर 2.5% विलंब शुल्क लागू होईल. पावत्या j.patel@clinic-health.co.uk वर पाठवल्या आहेत.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "कृपया तुमचे संपर्क तपशील निश्चित करा: Yuki Takahashi, मोबाईल +91-98220-55142, ईमेल fatima.al-rashid@example.co.uk.",
    },
  ],
  // Nepali
  ne: [
    {
      type: "appointment",
      label: "Appointment",
      text: "तपाईंको अपोइन्टमेन्ट मंगलबार, 15 मार्च 2026 बेलुका 3:30 बजेका लागि पक्का भएको छ। समय परिवर्तन गर्न +977-1-4123456 मा फोन गर्नुहोस्।",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "तपाईंको अर्डर SXN-7H3-KQ9 दरबारमार्ग 42, काठमाडौं 44600 मा बिहान 9:00 देखि बेलुका 5:30 बजेसम्म डेलिभर गरिनेछ। ट्र्याकिङ UPS-1Z999AA10।",
    },
    {
      type: "billing",
      label: "Billing",
      text: "तपाईंको रु 1,45,000 को बिल 15 मार्च 2026 मा तिर्नुपर्नेछ, 30 दिनपछि 2.5% ढिलाइ शुल्क लाग्नेछ। रसिदहरू j.patel@clinic-health.co.uk मा पठाइएको छ।",
    },
    {
      type: "contact",
      label: "Contact",
      text: "कृपया आफ्नो सम्पर्क विवरण पुष्टि गर्नुहोस्: Yuki Takahashi, मोबाइल +977-98-5555-0142, इमेल fatima.al-rashid@example.co.uk।",
    },
  ],
  // Norwegian
  no: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Timen din er bekreftet til tirsdag 15. mars 2026 kl. 15:30. Ring +47-21-23-45-67 for å endre tidspunktet.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Din bestilling SXN-7H3-KQ9 leveres på Karl Johans gate 42, 0162 Oslo mellom kl. 09:00 og 17:30. Sporing UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Din faktura på 13 450,00 kr forfaller 15. mars 2026, med en forsinkelsesrente på 2,5% etter 30 dager. Kvitteringer er sendt til j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Vennligst bekreft kontaktopplysningene dine: Yuki Takahashi, mobil +47-91-55-01-42, e-post fatima.al-rashid@example.co.uk.",
    },
  ],
  // Odia
  or: [
    {
      type: "appointment",
      label: "Appointment",
      text: "ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ମଙ୍ଗଳବାର, 15 ମାର୍ଚ୍ଚ 2026, ଅପରାହ୍ନ 3:30 ପାଇଁ ନିଶ୍ଚିତ ହୋଇଛି। ପୁନଃନିର୍ଧାରଣ ପାଇଁ +91-674-123-4567 ରେ କଲ କରନ୍ତୁ।",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "ଆପଣଙ୍କ ଅର୍ଡର SXN-7H3-KQ9 ଜନପଥ 42, ଭୁବନେଶ୍ୱର 751001 ଠିକଣାରେ ସକାଳ 9:00 ରୁ ଅପରାହ୍ନ 5:30 ମଧ୍ୟରେ ପହଞ୍ଚିବ। ଟ୍ରାକିଂ UPS-1Z999AA10।",
    },
    {
      type: "billing",
      label: "Billing",
      text: "ଆପଣଙ୍କ ₹1,08,450 ର ବିଲ 15 ମାର୍ଚ୍ଚ 2026 ରେ ଦେୟ, 30 ଦିନ ପରେ 2.5% ବିଳମ୍ବ ଶୁଳ୍କ ଲାଗୁ ହେବ। ରସିଦଗୁଡ଼ିକ j.patel@clinic-health.co.uk କୁ ପଠାଯାଇଛି।",
    },
    {
      type: "contact",
      label: "Contact",
      text: "ଦୟାକରି ଆପଣଙ୍କ ଯୋଗାଯୋଗ ବିବରଣୀ ନିଶ୍ଚିତ କରନ୍ତୁ: Yuki Takahashi, ମୋବାଇଲ +91-94370-55142, ଇମେଲ fatima.al-rashid@example.co.uk।",
    },
  ],
  // Pashto
  ps: [
    {
      type: "appointment",
      label: "Appointment",
      text: "ستاسو ملاقات د سه شنبې، د 2026 کال د مارچ په 15مه، د ماسپښین په 3:30 بجو تایید شوی دی. د وخت بدلولو لپاره +93-20-123-4567 ته زنګ ووهئ.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "ستاسو فرمایش SXN-7H3-KQ9 به د سهار له 9:00 بجو څخه د ماښام تر 5:30 بجو پورې د دارالامان سړک 42، کابل 1001 ته ورسول شي. تعقیب UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "ستاسو د 85,000 افغانیو بل د 2026 کال د مارچ په 15مه ورکول کېږي، له 30 ورځو وروسته به 2.5% د ځنډ جریمه ولګېږي. رسیدونه j.patel@clinic-health.co.uk ته لېږل شوي دي.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "مهرباني وکړئ خپل د اړیکې معلومات تایید کړئ: Yuki Takahashi، موبایل +93-70-555-0142، برېښنالیک fatima.al-rashid@example.co.uk.",
    },
  ],
  // Persian
  fa: [
    {
      type: "appointment",
      label: "Appointment",
      text: "نوبت شما برای سه‌شنبه، 15 مارس 2026 ساعت 3:30 بعد از ظهر تأیید شده است. برای تغییر زمان با شماره +98-21-1234-5678 تماس بگیرید.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "سفارش شما SXN-7H3-KQ9 به آدرس خیابان ولیعصر، پلاک 42، تهران 1415 بین ساعت 9:00 صبح و 5:30 بعد از ظهر تحویل داده می‌شود. شماره پیگیری UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "فاکتور شما به مبلغ 540,000,000 ریال در 15 مارس 2026 سررسید می‌شود، پس از 30 روز 2.5% جریمه تأخیر اعمال می‌شود. رسیدها به j.patel@clinic-health.co.uk ارسال شد.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "لطفاً اطلاعات تماس خود را تأیید کنید: Yuki Takahashi، موبایل +98-912-555-0142، ایمیل fatima.al-rashid@example.co.uk.",
    },
  ],
  // Polish
  pl: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Twoja wizyta jest potwierdzona na wtorek, 15 marca 2026 r., o godz. 15:30. Zadzwoń pod +48-22-123-45-67, aby zmienić termin.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Twoje zamówienie SXN-7H3-KQ9 zostanie dostarczone na ul. Marszałkowską 42, 00-061 Warszawa między godz. 09:00 a 17:30. Śledzenie UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Twoja faktura na kwotę 5.450,50 zł jest płatna do 15 marca 2026 r., odsetki za zwłokę 2,5% naliczane są po 30 dniach. Paragony zostały wysłane na j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Prosimy o potwierdzenie danych kontaktowych: Yuki Takahashi, tel. komórkowy +48-601-555-142, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Portuguese
  pt: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Sua consulta está confirmada para terça-feira, 15 de março de 2026, às 15:30. Ligue para +55-11-1234-5678 para reagendar.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Seu pedido SXN-7H3-KQ9 chegará à Av. Paulista 42, São Paulo, SP 01310-100 entre 09:00 e 17:30. Rastreamento UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Sua fatura no valor de R$ 6.850,00 vence em 15 de março de 2026, com uma taxa de atraso de 2,5% após 30 dias. Recibos enviados para j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Por favor confirme seus dados de contato: Yuki Takahashi, celular +55-11-95555-0142, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Punjabi
  pa: [
    {
      type: "appointment",
      label: "Appointment",
      text: "ਤੁਹਾਡੀ ਅਪੌਇੰਟਮੈਂਟ ਮੰਗਲਵਾਰ, 15 ਮਾਰਚ 2026 ਨੂੰ ਸ਼ਾਮ 3:30 ਵਜੇ ਦੀ ਪੁਸ਼ਟੀ ਕੀਤੀ ਗਈ ਹੈ। ਮੁੜ-ਨਿਯਤ ਕਰਨ ਲਈ +91-172-123-4567 'ਤੇ ਕਾਲ ਕਰੋ।",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "ਤੁਹਾਡਾ ਆਰਡਰ SXN-7H3-KQ9 ਸੈਕਟਰ 17, ਦੁਕਾਨ 42, ਚੰਡੀਗੜ੍ਹ 160017 ਉੱਤੇ ਸਵੇਰੇ 9:00 ਅਤੇ ਸ਼ਾਮ 5:30 ਵਿਚਕਾਰ ਪਹੁੰਚੇਗਾ। ਟ੍ਰੈਕਿੰਗ UPS-1Z999AA10।",
    },
    {
      type: "billing",
      label: "Billing",
      text: "ਤੁਹਾਡਾ ₹1,08,450 ਦਾ ਬਿੱਲ 15 ਮਾਰਚ 2026 ਨੂੰ ਭੁਗਤਾਨਯੋਗ ਹੈ, 30 ਦਿਨਾਂ ਬਾਅਦ 2.5% ਦੇਰੀ ਫੀਸ ਲਾਗੂ ਹੋਵੇਗੀ। ਰਸੀਦਾਂ j.patel@clinic-health.co.uk ਉੱਤੇ ਭੇਜੀਆਂ ਗਈਆਂ ਹਨ।",
    },
    {
      type: "contact",
      label: "Contact",
      text: "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਸੰਪਰਕ ਵੇਰਵਿਆਂ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ: Yuki Takahashi, ਮੋਬਾਈਲ +91-98140-55142, ਈਮੇਲ fatima.al-rashid@example.co.uk।",
    },
  ],
  // Romanian
  ro: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Programarea dvs. este confirmată pentru marți, 15 martie 2026, la ora 15:30. Sunați la +40-21-123-4567 pentru a o reprograma.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Comanda dvs. SXN-7H3-KQ9 va fi livrată pe Bd. Magheru nr. 42, 010336 București între orele 09:00 și 17:30. Urmărire UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Factura dvs. de 6.450,50 lei este scadentă la 15 martie 2026, cu o penalitate de 2,5% după 30 de zile. Chitanțele au fost trimise la j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Vă rugăm să confirmați datele de contact: Yuki Takahashi, mobil +40-721-555-142, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Russian
  ru: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Ваш приём подтверждён на вторник, 15 марта 2026 года, в 15:30. Позвоните по номеру +7-495-123-45-67, чтобы перенести.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Ваш заказ SXN-7H3-KQ9 будет доставлен по адресу ул. Тверская, д. 42, 125009 Москва с 09:00 до 17:30. Номер отслеживания UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ваш счёт на сумму 125 750,50 ₽ подлежит оплате 15 марта 2026 года, после 30 дней начисляется пеня 2,5%. Квитанции отправлены на j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Пожалуйста, подтвердите контактные данные: Yuki Takahashi, мобильный +7-916-555-01-42, электронная почта fatima.al-rashid@example.co.uk.",
    },
  ],
  // Serbian
  sr: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Ваш преглед потврђен је за уторак, 15. марта 2026. у 15:30. Позовите +381-11-123-4567 за промену термина.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Ваша наруџбина SXN-7H3-KQ9 стићи ће на адресу Кнез Михаилова 42, 11000 Београд између 09:00 и 17:30. Праћење UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ваш рачун у износу од 145.000 дин. доспева 15. марта 2026, уз затезну камату од 2,5% након 30 дана. Потврде су послате на j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Молимо потврдите контакт податке: Yuki Takahashi, мобилни +381-64-555-0142, имејл fatima.al-rashid@example.co.uk.",
    },
  ],
  // Sindhi
  sd: [
    {
      type: "appointment",
      label: "Appointment",
      text: "توهان جي ملاقات اڱاري، 15 مارچ 2026 تي شام 3:30 وڳي لاءِ پڪي ٿي وئي آهي. وقت بدلائڻ لاءِ +92-22-123-4567 تي فون ڪريو.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "توهان جو آرڊر SXN-7H3-KQ9 صبح 9:00 کان شام 5:30 وڳي جي وچ ۾ شاهراهِ فيصل 42، ڪراچي 75350 تي پهچايو ويندو. ٽريڪنگ UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "توهان جو Rs 385,000 جو بل 15 مارچ 2026 تي ادا ڪرڻو آهي، 30 ڏينهن کانپوءِ 2.5% دير جي فيس لاڳو ٿيندي. رسيدون j.patel@clinic-health.co.uk تي موڪليون ويون آهن.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "مهرباني ڪري پنهنجي رابطي جي تفصيل جي تصديق ڪريو: Yuki Takahashi، موبائل +92-300-555-0142، اي ميل fatima.al-rashid@example.co.uk.",
    },
  ],
  // Slovak
  sk: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Vaša návšteva je potvrdená na utorok 15. marca 2026 o 15:30. Pre zmenu termínu volajte na +421-2-123-456-78.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Vaša objednávka SXN-7H3-KQ9 bude doručená na adresu Hlavná 42, 811 01 Bratislava medzi 09:00 a 17:30. Sledovanie UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Vaša faktúra vo výške 1 299,50 € je splatná 15. marca 2026, s úrokom z omeškania 2,5 % po 30 dňoch. Potvrdenky boli odoslané na j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Prosím potvrďte svoje kontaktné údaje: Yuki Takahashi, mobil +421-903-555-142, e-mail fatima.al-rashid@example.co.uk.",
    },
  ],
  // Slovenian
  sl: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Vaš pregled je potrjen za torek, 15. marca 2026, ob 15.30. Pokličite +386-1-400-1234 za prestavitev termina.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Vaše naročilo SXN-7H3-KQ9 bo dostavljeno na Slovenska cesta 42, 1000 Ljubljana med 9.00 in 17.30. Sledenje UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Račun v znesku 1.299,50 € zapade 15. marca 2026, po 30 dneh veljajo 2,5 % zamudne obresti. Potrdila so bila poslana na j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Prosimo, potrdite svoje kontaktne podatke: Yuki Takahashi, mobilni +386-40-555-142, e-pošta fatima.al-rashid@example.co.uk.",
    },
  ],
  // Somali
  so: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Ballantaada waxaa la xaqiijiyay Talaado, 15 Maarso 2026, saacadda 15:30. Wac +252-61-123-4567 si aad wakhtiga u beddesho.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Dalabkaaga SXN-7H3-KQ9 waxaa la geyn doonaa Wadada Maka Al-Mukarama 42, Muqdisho, inta u dhaxaysa 9:00 iyo 17:30. Raadraac UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Biilkaaga oo dhan $1,299.50 waxaa la bixinayaa 15 Maarso 2026, iyadoo 2.5% ganaax daahitaan ah lagu dari doono 30 maalmood kadib. Rasiidhada waxaa loo diray j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Fadlan xaqiiji macluumaadkaaga xiriirka: Yuki Takahashi, mobilka +252-61-555-0142, iimaylka fatima.al-rashid@example.co.uk.",
    },
  ],
  // Spanish
  es: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Su cita está confirmada para el martes 15 de marzo de 2026 a las 15:30. Llame al +34-91-123-4567 para reprogramarla.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Su pedido SXN-7H3-KQ9 llegará a Calle Gran Vía 42, 28013 Madrid entre las 09:00 y las 17:30. Seguimiento UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Su factura de 1.299,50 € vence el 15 de marzo de 2026, con un recargo del 2,5% después de 30 días. Los recibos se han enviado a j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Por favor, confirme sus datos de contacto: Yuki Takahashi, móvil +34-688-555-142, correo fatima.al-rashid@example.co.uk.",
    },
  ],
  // Swahili
  sw: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Miadi yako imethibitishwa Jumanne, tarehe 15 Machi 2026 saa 3:30 alasiri. Piga simu +255-22-123-4567 ili kuratibu upya.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Agizo lako SXN-7H3-KQ9 litafika Mtaa wa Samora 42, Dar es Salaam 11101 kati ya saa 9:00 asubuhi na 5:30 jioni. Kufuatilia UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ankara yako ya TSh 2,850,000 inatakiwa kulipwa tarehe 15 Machi 2026, faini ya kuchelewa ya 2.5% inatumika baada ya siku 30. Risiti zimetumwa kwa j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Tafadhali thibitisha maelezo yako ya mawasiliano: Yuki Takahashi, simu ya mkononi +255-75-555-0142, barua pepe fatima.al-rashid@example.co.uk.",
    },
  ],
  // Swedish
  sv: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Din tid är bekräftad till tisdag den 15 mars 2026 kl. 15:30. Ring +46-8-123-4567 för att boka om.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Din beställning SXN-7H3-KQ9 levereras till Drottninggatan 42, 111 21 Stockholm mellan kl. 09:00 och 17:30. Spårning UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Din faktura på 13 450,00 kr förfaller den 15 mars 2026, med en dröjsmålsränta på 2,5% efter 30 dagar. Kvitton har skickats till j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Vänligen bekräfta dina kontaktuppgifter: Yuki Takahashi, mobil +46-70-555-01-42, e-post fatima.al-rashid@example.co.uk.",
    },
  ],
  // Tagalog
  tl: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Nakumpirma ang iyong appointment sa Martes, Marso 15, 2026 nang 3:30 ng hapon. Tumawag sa +63-2-1234-5678 para sa pagbabago ng iskedyul.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Ang iyong order na SXN-7H3-KQ9 ay darating sa Ayala Avenue 42, Makati City 1226 sa pagitan ng 9:00 ng umaga at 5:30 ng hapon. Tracking UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ang iyong invoice na ₱72,500.00 ay dapat bayaran sa Marso 15, 2026, na may 2.5% na multa pagkatapos ng 30 araw. Ipinadala ang mga resibo sa j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Pakikumpirma ang iyong mga detalye ng kontak: Yuki Takahashi, mobile +63-917-555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Tamil
  ta: [
    {
      type: "appointment",
      label: "Appointment",
      text: "உங்கள் சந்திப்பு செவ்வாய்க்கிழமை, 15 மார்ச் 2026 அன்று மாலை 3:30 மணிக்கு உறுதி செய்யப்பட்டுள்ளது. மீண்டும் திட்டமிட +91-44-1234-5678 என்ற எண்ணுக்கு அழைக்கவும்.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "உங்கள் ஆர்டர் SXN-7H3-KQ9 அண்ணா சாலை 42, சென்னை 600002 என்ற முகவரிக்கு காலை 9:00 முதல் மாலை 5:30 மணிக்குள் வந்து சேரும். கண்காணிப்பு UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "உங்கள் ₹1,08,450 ரசீது 15 மார்ச் 2026 அன்று செலுத்தப்பட வேண்டும், 30 நாட்களுக்குப் பிறகு 2.5% தாமத கட்டணம் பொருந்தும். ரசீதுகள் j.patel@clinic-health.co.uk க்கு அனுப்பப்பட்டுள்ளன.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "உங்கள் தொடர்பு விவரங்களை உறுதிப்படுத்தவும்: Yuki Takahashi, மொபைல் +91-98410-55142, மின்னஞ்சல் fatima.al-rashid@example.co.uk.",
    },
  ],
  // Telugu
  te: [
    {
      type: "appointment",
      label: "Appointment",
      text: "మీ అపాయింట్‌మెంట్ మంగళవారం, 15 మార్చి 2026 సాయంత్రం 3:30 గంటలకు ధృవీకరించబడింది. పునఃనిర్ణయించడానికి +91-40-1234-5678 కు కాల్ చేయండి.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "మీ ఆర్డర్ SXN-7H3-KQ9 బంజారా హిల్స్ రోడ్ 42, హైదరాబాద్ 500034 కు ఉదయం 9:00 మరియు సాయంత్రం 5:30 మధ్య చేరుతుంది. ట్రాకింగ్ UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "మీ ₹1,08,450 బిల్లు 15 మార్చి 2026 న చెల్లించవలసి ఉంది, 30 రోజుల తర్వాత 2.5% ఆలస్య రుసుము వర్తిస్తుంది. రసీదులు j.patel@clinic-health.co.uk కు పంపబడ్డాయి.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "దయచేసి మీ సంప్రదింపు వివరాలను ధృవీకరించండి: Yuki Takahashi, మొబైల్ +91-98480-55142, ఇమెయిల్ fatima.al-rashid@example.co.uk.",
    },
  ],
  // Thai
  th: [
    {
      type: "appointment",
      label: "Appointment",
      text: "การนัดหมายของคุณได้รับการยืนยันในวันอังคารที่ 15 มีนาคม 2026 เวลา 15:30 น. โทรหาเราที่ +66-2-123-4567 เพื่อเปลี่ยนเวลานัด",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "คำสั่งซื้อของคุณ SXN-7H3-KQ9 จะจัดส่งที่ถนนสุขุมวิท 42 แขวงคลองเตย กรุงเทพฯ 10110 ระหว่างเวลา 9:00 น. ถึง 17:30 น. หมายเลขติดตาม UPS-1Z999AA10",
    },
    {
      type: "billing",
      label: "Billing",
      text: "ใบแจ้งหนี้ของคุณจำนวน ฿45,250 ครบกำหนดชำระวันที่ 15 มีนาคม 2026 โดยมีค่าปรับล่าช้า 2.5% หลังจาก 30 วัน ใบเสร็จส่งไปยัง j.patel@clinic-health.co.uk",
    },
    {
      type: "contact",
      label: "Contact",
      text: "กรุณายืนยันข้อมูลติดต่อ: Yuki Takahashi มือถือ +66-81-555-0142 อีเมล fatima.al-rashid@example.co.uk",
    },
  ],
  // Turkish
  tr: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Randevunuz 15 Mart 2026 Salı günü saat 15:30 için onaylanmıştır. Randevuyu değiştirmek için +90-212-123-4567 numaralı telefonu arayın.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "SXN-7H3-KQ9 siparişiniz İstiklal Cad. No: 42, 34433 Beyoğlu/İstanbul adresine saat 09:00 ile 17:30 arasında teslim edilecektir. Takip UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "42.500,00 ₺ tutarındaki faturanızın son ödeme tarihi 15 Mart 2026'dır ve 30 gün sonra %2,5 gecikme faizi uygulanır. Makbuzlar j.patel@clinic-health.co.uk adresine gönderildi.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Lütfen iletişim bilgilerinizi onaylayın: Yuki Takahashi, cep telefonu +90-532-555-0142, e-posta fatima.al-rashid@example.co.uk.",
    },
  ],
  // Ukrainian
  uk: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Ваш прийом підтверджено на вівторок, 15 березня 2026 року, о 15:30. Зателефонуйте за номером +380-44-123-4567, щоб перенести візит.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Ваше замовлення SXN-7H3-KQ9 буде доставлено на вул. Хрещатик, 42, 01001 Київ з 09:00 до 17:30. Номер відстеження UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Ваш рахунок на суму 52 450,00 ₴ підлягає оплаті 15 березня 2026 року, через 30 днів нараховується пеня 2,5%. Квитанції надіслано на j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Будь ласка, підтвердіть контактні дані: Yuki Takahashi, мобільний +380-67-555-0142, електронна пошта fatima.al-rashid@example.co.uk.",
    },
  ],
  // Urdu
  ur: [
    {
      type: "appointment",
      label: "Appointment",
      text: "آپ کا اپائنٹمنٹ منگل، 15 مارچ 2026 شام 3:30 بجے کے لیے کنفرم ہے۔ دوبارہ وقت مقرر کرنے کے لیے +92-21-1234-5678 پر کال کریں۔",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "آپ کا آرڈر SXN-7H3-KQ9 ایم اے جناح روڈ 42، کراچی 74400 پر صبح 9:00 بجے اور شام 5:30 بجے کے درمیان پہنچے گا۔ ٹریکنگ UPS-1Z999AA10۔",
    },
    {
      type: "billing",
      label: "Billing",
      text: "آپ کا Rs 385,000 کا بل 15 مارچ 2026 کو واجب الادا ہے، 30 دن کے بعد 2.5% تاخیر فیس لاگو ہوگی۔ رسیدیں j.patel@clinic-health.co.uk پر بھیج دی گئی ہیں۔",
    },
    {
      type: "contact",
      label: "Contact",
      text: "براہ کرم اپنی رابطہ کی تفصیلات کی تصدیق کریں: Yuki Takahashi، موبائل +92-300-555-0142، ای میل fatima.al-rashid@example.co.uk۔",
    },
  ],
  // Vietnamese
  vi: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Cuộc hẹn của bạn đã được xác nhận vào thứ Ba, ngày 15 tháng 3 năm 2026 lúc 15:30. Gọi +84-28-1234-5678 để đổi lịch.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Đơn hàng SXN-7H3-KQ9 của bạn sẽ được giao đến 42 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh 700000 từ 09:00 đến 17:30. Mã theo dõi UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Hóa đơn của bạn trị giá 32.450.000 ₫ đến hạn thanh toán vào ngày 15 tháng 3 năm 2026, phí trễ hạn 2,5% được áp dụng sau 30 ngày. Biên lai đã gửi đến j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "Vui lòng xác nhận thông tin liên hệ: Yuki Takahashi, di động +84-90-555-0142, email fatima.al-rashid@example.co.uk.",
    },
  ],
  // Welsh
  cy: [
    {
      type: "appointment",
      label: "Appointment",
      text: "Mae eich apwyntiad wedi ei gadarnhau ar gyfer dydd Mawrth, 15 Mawrth 2026 am 15:30. Ffoniwch +44-29-1234-5678 i aildrefnu.",
    },
    {
      type: "delivery",
      label: "Delivery",
      text: "Bydd eich archeb SXN-7H3-KQ9 yn cyrraedd 42 Heol y Frenhines, Caerdydd CF10 2BH rhwng 09:00 a 17:30. Olrhain UPS-1Z999AA10.",
    },
    {
      type: "billing",
      label: "Billing",
      text: "Mae eich anfoneb o £1,299.50 yn ddyledus ar 15 Mawrth 2026, gyda ffi hwyr o 2.5% ar ôl 30 diwrnod. Anfonwyd y derbynebau at j.patel@clinic-health.co.uk.",
    },
    {
      type: "contact",
      label: "Contact",
      text: "A wnewch chi gadarnhau eich manylion cyswllt: Yuki Takahashi, ffôn symudol +44-77-5555-0142, e-bost fatima.al-rashid@example.co.uk.",
    },
  ],
};

export function getSamplesForLanguage(language: string): CompareTtsSample[] {
  return TTS_SAMPLES[language] || TTS_SAMPLES["en"];
}

export function getFirstSampleText(language: string): string {
  const samples = getSamplesForLanguage(language);
  return samples[0]?.text || "";
}
